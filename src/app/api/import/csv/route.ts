import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";
import { parseCSV, ParsedTransaction } from "@/lib/csv-parser";

export async function POST(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const action = formData.get("action") as string; // "preview" or "import"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Read file content
    const content = await file.text();
    
    // Parse CSV
    const parseResult = parseCSV(content);
    
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: parseResult.errors[0] || "Failed to parse CSV",
        errors: parseResult.errors,
      }, { status: 400 });
    }

    // If preview only, return parsed transactions
    if (action === "preview") {
      return NextResponse.json({
        success: true,
        bank: parseResult.bank,
        transactions: parseResult.transactions,
        count: parseResult.transactions.length,
        errors: parseResult.errors,
      });
    }

    // Import transactions
    // Get or create import account for this bank
    const bankName = parseResult.bank === "mbank" ? "mBank Import" : "ING Import";
    const bankId = parseResult.bank === "mbank" ? "MBANK_IMPORT" : "ING_IMPORT";
    
    let account;
    const { data: existingAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("external_id", `import-${parseResult.bank}`)
      .single();

    if (existingAccount) {
      account = existingAccount;
    } else {
      // Create account
      const { data: newAccount, error: accountError } = await supabase
        .from("accounts")
        .insert({
          user_id: user.id,
          external_id: `import-${parseResult.bank}`,
          name: bankName,
          currency: "PLN",
          balance: 0,
        })
        .select()
        .single();

      if (accountError) {
        return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
      }

      account = newAccount;
    }

    // Get categorization rules - query both system rules and user rules
    const { data: systemRules } = await supabase
      .from("categorization_rules")
      .select("keyword, category_id")
      .eq("is_system", true);

    const { data: userRules } = await supabase
      .from("categorization_rules")
      .select("keyword, category_id")
      .eq("user_id", user.id);

    const rules = [...(systemRules || []), ...(userRules || [])];

    // Get active recurring expenses for matching
    const { data: recurringExpenses } = await supabase
      .from("recurring_expenses")
      .select("id, amount, category_id, match_keywords, interval_months, last_occurrence_date, start_date")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const normalizeText = (text: string) => 
      text.toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Function to find category
    const findCategory = (merchant: string | null, description: string) => {
      const searchText = normalizeText(`${merchant || ""} ${description}`);
      
      for (const rule of rules) {
        const keyword = normalizeText(rule.keyword);
        if (searchText.includes(keyword)) {
          return rule.category_id;
        }
      }
      return null;
    };

    // Track which recurring expenses have been matched this import (by month)
    const matchedRecurringByMonth: Map<string, Set<string>> = new Map();

    // Function to find recurring expense match
    const findRecurringMatch = async (
      merchant: string | null,
      description: string,
      transactionDate: string
    ): Promise<{ recurringId: string | null; categoryId: string | null }> => {
      if (!recurringExpenses || recurringExpenses.length === 0) {
        return { recurringId: null, categoryId: null };
      }

      const searchText = normalizeText(`${merchant || ""} ${description}`);
      const txDate = new Date(transactionDate);
      const txMonth = txDate.getFullYear() * 12 + txDate.getMonth();
      const txMonthKey = transactionDate.substring(0, 7);

      for (const recurring of recurringExpenses) {
        const keywords = recurring.match_keywords || [];
        const keywordMatch = keywords.some((keyword: string) =>
          searchText.includes(keyword.toLowerCase())
        );

        if (keywordMatch) {
          // Check if this expense is due based on interval
          const intervalMonths = recurring.interval_months || 1;
          let isDue = true;

          if (recurring.last_occurrence_date) {
            const lastDate = new Date(recurring.last_occurrence_date);
            const lastMonth = lastDate.getFullYear() * 12 + lastDate.getMonth();
            const monthsSinceLast = txMonth - lastMonth;
            isDue = monthsSinceLast >= intervalMonths;
          } else {
            const startDate = new Date(recurring.start_date);
            const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
            const monthsSinceStart = txMonth - startMonth;
            isDue = monthsSinceStart >= 0 && monthsSinceStart % intervalMonths === 0;
          }

          if (isDue) {
            // Check if already matched this month (in this import or database)
            const monthMatchKey = `${recurring.id}-${txMonthKey}`;
            if (!matchedRecurringByMonth.has(txMonthKey)) {
              matchedRecurringByMonth.set(txMonthKey, new Set());
            }

            if (!matchedRecurringByMonth.get(txMonthKey)!.has(recurring.id)) {
              // Check database for existing match this month
              const { data: alreadyMatched } = await supabase
                .from("transactions")
                .select("id")
                .eq("recurring_expense_id", recurring.id)
                .gte("transaction_date", `${txMonthKey}-01`)
                .lte("transaction_date", `${txMonthKey}-31`)
                .limit(1);

              if (!alreadyMatched || alreadyMatched.length === 0) {
                matchedRecurringByMonth.get(txMonthKey)!.add(recurring.id);
                return {
                  recurringId: recurring.id,
                  categoryId: recurring.category_id,
                };
              }
            }
          }
        }
      }

      return { recurringId: null, categoryId: null };
    };

    // Check for existing transactions to avoid duplicates
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("external_id")
      .eq("user_id", user.id);

    const existingIds = new Set((existingTx || []).map((t: { external_id: string }) => t.external_id));

    // Import transactions
    let imported = 0;
    let skipped = 0;

    for (const tx of parseResult.transactions) {
      // Generate unique ID based on date, amount, and description
      const externalId = `csv-${parseResult.bank}-${tx.date}-${tx.amount}-${tx.description.substring(0, 20)}`.replace(/[^a-zA-Z0-9-]/g, "_");
      
      // Skip if already exists
      if (existingIds.has(externalId)) {
        skipped++;
        continue;
      }

      // Try to match recurring expense first
      const recurringMatch = await findRecurringMatch(tx.merchantName, tx.description, tx.date);
      
      // Use recurring expense category if matched, otherwise use categorization rules
      const categoryId = recurringMatch.categoryId || findCategory(tx.merchantName, tx.description);

      const { error: insertError } = await supabase.from("transactions").insert({
        user_id: user.id,
        account_id: account.id,
        external_id: externalId,
        amount: tx.amount,
        currency: tx.currency,
        description: tx.description,
        merchant_name: tx.merchantName,
        category_id: categoryId,
        recurring_expense_id: recurringMatch.recurringId,
        transaction_date: tx.date,
        booking_date: tx.date,
        type: tx.type,
      });

      if (!insertError) {
        imported++;
        existingIds.add(externalId);
        
        // Update last_occurrence_date for recurring expense if matched
        if (recurringMatch.recurringId) {
          await supabase
            .from("recurring_expenses")
            .update({ last_occurrence_date: tx.date })
            .eq("id", recurringMatch.recurringId);
        }
      }
    }

    return NextResponse.json({
      success: true,
      bank: parseResult.bank,
      imported,
      skipped,
      total: parseResult.transactions.length,
    });
  } catch (error) {
    console.error("Error importing CSV:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
