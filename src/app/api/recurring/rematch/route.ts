import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

// POST - Re-match existing transactions to recurring expenses
export async function POST() {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all active recurring expenses with keywords
    const { data: recurringExpenses, error: recurringError } = await supabase
      .from("recurring_expenses")
      .select("id, amount, category_id, match_keywords, interval_months, start_date")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (recurringError) {
      return NextResponse.json(
        { error: "Failed to fetch recurring expenses" },
        { status: 500 }
      );
    }

    if (!recurringExpenses || recurringExpenses.length === 0) {
      return NextResponse.json({
        success: true,
        matched: 0,
        message: "No active recurring expenses with keywords to match",
      });
    }

    // Get all expense transactions without recurring_expense_id
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("id, description, merchant_name, transaction_date")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .is("recurring_expense_id", null)
      .order("transaction_date", { ascending: true });

    if (txError) {
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: true,
        matched: 0,
        message: "No unmatched transactions found",
      });
    }

    // Track matches by recurring expense and month (to ensure only one match per month)
    const matchedByMonth: Map<string, string> = new Map(); // "recurringId-YYYY-MM" -> transactionId

    // First pass: find potential matches
    const potentialMatches: Array<{
      transactionId: string;
      recurringId: string;
      categoryId: string | null;
      transactionDate: string;
      monthKey: string;
    }> = [];

    for (const tx of transactions) {
      const searchText = ((tx.merchant_name || "") + " " + tx.description).toLowerCase();
      const txDate = new Date(tx.transaction_date);
      const txMonth = txDate.getFullYear() * 12 + txDate.getMonth();
      const txMonthKey = tx.transaction_date.substring(0, 7);

      for (const recurring of recurringExpenses) {
        const keywords = recurring.match_keywords || [];
        if (keywords.length === 0) continue;

        const keywordMatch = keywords.some((keyword: string) =>
          searchText.includes(keyword.toLowerCase())
        );

        if (!keywordMatch) continue;

        // Check if this expense should be due in this month based on interval
        const intervalMonths = recurring.interval_months || 1;
        const startDate = new Date(recurring.start_date);
        const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
        const monthsSinceStart = txMonth - startMonth;

        if (monthsSinceStart >= 0 && monthsSinceStart % intervalMonths === 0) {
          potentialMatches.push({
            transactionId: tx.id,
            recurringId: recurring.id,
            categoryId: recurring.category_id,
            transactionDate: tx.transaction_date,
            monthKey: `${recurring.id}-${txMonthKey}`,
          });
        }
      }
    }

    // Check which months already have matches in the database
    const recurringIds = [...new Set(potentialMatches.map((m) => m.recurringId))];
    const { data: existingMatches } = await supabase
      .from("transactions")
      .select("recurring_expense_id, transaction_date")
      .eq("user_id", user.id)
      .in("recurring_expense_id", recurringIds);

    const existingMatchedMonths = new Set<string>();
    if (existingMatches) {
      for (const match of existingMatches) {
        const monthKey = `${match.recurring_expense_id}-${match.transaction_date.substring(0, 7)}`;
        existingMatchedMonths.add(monthKey);
      }
    }

    // Second pass: apply matches (only one per recurring expense per month)
    let matched = 0;
    const appliedMonths = new Set<string>();

    for (const match of potentialMatches) {
      // Skip if this month already has a match
      if (existingMatchedMonths.has(match.monthKey) || appliedMonths.has(match.monthKey)) {
        continue;
      }

      // Update the transaction
      const updateData: Record<string, unknown> = {
        recurring_expense_id: match.recurringId,
      };

      // Also update category if the recurring expense has one
      if (match.categoryId) {
        updateData.category_id = match.categoryId;
      }

      const { error: updateError } = await supabase
        .from("transactions")
        .update(updateData)
        .eq("id", match.transactionId)
        .eq("user_id", user.id);

      if (!updateError) {
        matched++;
        appliedMonths.add(match.monthKey);

        // Update last_occurrence_date
        await supabase
          .from("recurring_expenses")
          .update({ last_occurrence_date: match.transactionDate })
          .eq("id", match.recurringId);
      }
    }

    return NextResponse.json({
      success: true,
      matched,
      scanned: transactions.length,
      message: `Dopasowano ${matched} transakcji do wydatków cyklicznych`,
    });
  } catch (error) {
    console.error("Error re-matching transactions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
