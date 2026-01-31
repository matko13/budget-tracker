import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";
import { parseMT940, ParsedTransaction } from "@/lib/mt940-parser";

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
    const transactionsJson = formData.get("transactions") as string | null;

    if (!file && action !== "import") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // If importing with edited transactions
    if (action === "import" && transactionsJson) {
      const transactions: ParsedTransaction[] = JSON.parse(transactionsJson);
      return await importTransactions(supabase, user.id, transactions);
    }

    // Read file content
    const content = await file!.text();

    // Parse MT940
    const parseResult = parseMT940(content);

    if (!parseResult.success && parseResult.transactions.length === 0) {
      return NextResponse.json({
        success: false,
        error: parseResult.errors[0] || "Failed to parse MT940 file",
        errors: parseResult.errors,
      }, { status: 400 });
    }

    // If preview only, return parsed transactions
    if (action === "preview") {
      return NextResponse.json({
        success: true,
        format: "mt940",
        accountNumber: parseResult.accountNumber,
        currency: parseResult.currency,
        statementDate: parseResult.statementDate,
        transactions: parseResult.transactions,
        count: parseResult.transactions.length,
        errors: parseResult.errors,
      });
    }

    // Import transactions
    return await importTransactions(supabase, user.id, parseResult.transactions, parseResult.currency);
  } catch (error) {
    console.error("Error importing MT940:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function importTransactions(
  supabase: ReturnType<typeof createUntypedClient> extends Promise<infer T> ? T : never,
  userId: string,
  transactions: ParsedTransaction[],
  defaultCurrency: string = "PLN"
) {
  // Get or create MT940 import account
  let account;
  const { data: existingAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("external_id", "mt940-import")
    .single();

  if (existingAccount) {
    account = existingAccount;
  } else {
    // Create account
    const { data: newAccount, error: accountError } = await supabase
      .from("accounts")
      .insert({
        user_id: userId,
        external_id: "mt940-import",
        name: "MT940 Import",
        currency: defaultCurrency,
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
    .eq("user_id", userId);

  const rules = [...(systemRules || []), ...(userRules || [])];
  console.log(`Loaded ${rules.length} categorization rules`);

  // Function to find category - improved matching
  const findCategory = (merchant: string | null, description: string) => {
    // Normalize text: lowercase, remove special chars
    const normalizeText = (text: string) => 
      text.toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    const searchText = normalizeText(`${merchant || ""} ${description}`);
    
    for (const rule of rules) {
      const keyword = normalizeText(rule.keyword);
      if (searchText.includes(keyword)) {
        return rule.category_id;
      }
    }
    return null;
  };

  // Check for existing transactions to avoid duplicates
  const { data: existingTx } = await supabase
    .from("transactions")
    .select("external_id")
    .eq("user_id", userId);

  const existingIds = new Set((existingTx || []).map((t: { external_id: string }) => t.external_id));

  // Import transactions
  let imported = 0;
  let skipped = 0;

  for (const tx of transactions) {
    // Generate unique ID based on date, amount, and reference/description
    const ref = tx.reference || tx.description.substring(0, 20);
    const externalId = `mt940-${tx.date}-${tx.amount}-${ref}`.replace(/[^a-zA-Z0-9-]/g, "_");

    // Skip if already exists
    if (existingIds.has(externalId)) {
      skipped++;
      continue;
    }

    const categoryId = findCategory(tx.merchantName, tx.description);

    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: userId,
      account_id: account.id,
      external_id: externalId,
      amount: tx.amount,
      currency: tx.currency || defaultCurrency,
      description: tx.description,
      merchant_name: tx.merchantName,
      category_id: categoryId,
      transaction_date: tx.date,
      booking_date: tx.date,
      type: tx.type,
    });

    if (!insertError) {
      imported++;
      existingIds.add(externalId);
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    skipped,
    total: transactions.length,
  });
}
