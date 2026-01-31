import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

// Helper to check if an expense is due in a specific month based on interval
function isExpenseDueInMonth(
  expense: {
    interval_months: number;
    start_date: string;
  },
  targetYear: number,
  targetMonth: number
): boolean {
  const targetMonthNum = targetYear * 12 + targetMonth;
  const startDate = new Date(expense.start_date);
  const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
  const monthsSinceStart = targetMonthNum - startMonth;

  return monthsSinceStart >= 0 && monthsSinceStart % expense.interval_months === 0;
}

// POST - Generate recurring expense transactions for a given month
export async function POST(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { month } = await request.json(); // Format: "YYYY-MM"

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Use YYYY-MM" },
        { status: 400 }
      );
    }

    const [year, monthNum] = month.split("-").map(Number);
    const targetMonth = monthNum - 1; // JS months are 0-indexed

    // Get all active recurring expenses
    const { data: recurringExpenses, error: recurringError } = await supabase
      .from("recurring_expenses")
      .select("*, categories(*)")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (recurringError) {
      return NextResponse.json(
        { error: "Failed to fetch recurring expenses" },
        { status: 500 }
      );
    }

    // Get any overrides for this month
    const monthKey = `${month}-01`;
    const { data: overrides } = await supabase
      .from("recurring_expense_overrides")
      .select("*")
      .eq("user_id", user.id)
      .eq("override_month", monthKey);

    const overridesMap = new Map(
      overrides?.map((o) => [o.recurring_expense_id, o]) || []
    );

    // Get existing generated transactions for this month
    const monthStart = `${month}-01`;
    const monthEnd = new Date(year, targetMonth + 1, 0).toISOString().split("T")[0];

    const { data: existingGenerated } = await supabase
      .from("transactions")
      .select("recurring_expense_id")
      .eq("user_id", user.id)
      .eq("is_recurring_generated", true)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd);

    const existingRecurringIds = new Set(
      existingGenerated?.map((t) => t.recurring_expense_id) || []
    );

    // Get or create a "Recurring" account for generated transactions
    let account;
    const { data: existingAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("external_id", "recurring-generated")
      .single();

    if (existingAccount) {
      account = existingAccount;
    } else {
      const { data: newAccount, error: accountError } = await supabase
        .from("accounts")
        .insert({
          user_id: user.id,
          external_id: "recurring-generated",
          name: "Wydatki cykliczne",
          currency: "PLN",
          balance: 0,
        })
        .select()
        .single();

      if (accountError) {
        console.error("Error creating account:", accountError);
        return NextResponse.json(
          { error: "Failed to create recurring account" },
          { status: 500 }
        );
      }
      account = newAccount;
    }

    let generated = 0;
    let skippedExisting = 0;

    for (const expense of recurringExpenses || []) {
      // Check if this expense is due this month
      if (!isExpenseDueInMonth(expense, year, targetMonth)) {
        continue;
      }

      // Skip if already has a generated transaction
      if (existingRecurringIds.has(expense.id)) {
        skippedExisting++;
        continue;
      }

      // Check for override (skip or custom amount)
      const override = overridesMap.get(expense.id);
      if (override?.is_skipped) {
        continue; // Don't generate for skipped expenses
      }

      // Determine transaction date based on day_of_month
      const dayOfMonth = expense.day_of_month || 1;
      const lastDayOfMonth = new Date(year, targetMonth + 1, 0).getDate();
      const actualDay = Math.min(dayOfMonth, lastDayOfMonth);
      const transactionDate = `${month}-${String(actualDay).padStart(2, "0")}`;

      // Use override amount if available
      const amount = override?.override_amount ?? expense.amount;

      // Always set as 'planned' for generated transactions - they are placeholders.
      // Status becomes 'completed' only when matched with a real bank transaction.
      const { error: insertError } = await supabase.from("transactions").insert({
        user_id: user.id,
        account_id: account.id,
        external_id: null,
        amount: Math.abs(parseFloat(amount)),
        currency: expense.currency,
        description: expense.name,
        merchant_name: expense.name,
        category_id: expense.category_id,
        recurring_expense_id: expense.id,
        transaction_date: transactionDate,
        booking_date: transactionDate,
        type: "expense",
        is_recurring_generated: true,
        payment_status: "planned",
      });

      if (!insertError) {
        generated++;
      } else {
        console.error("Error inserting transaction:", insertError);
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      skippedExisting,
      month,
    });
  } catch (error) {
    console.error("Error generating recurring transactions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
