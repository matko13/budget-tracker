import { createUntypedClient } from "@/lib/supabase/server-untyped";

/**
 * Helper to check if an expense is due in a specific month based on interval
 */
export function isExpenseDueInMonth(
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

/**
 * Auto-generate recurring expense transactions for a month if they don't exist.
 * Uses the database unique index to prevent duplicates even under race conditions.
 */
export async function ensureRecurringTransactions(
  supabase: Awaited<ReturnType<typeof createUntypedClient>>,
  userId: string,
  year: number,
  month: number // 0-indexed
) {
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthStart = `${monthStr}-01`;
  const monthEnd = new Date(year, month + 1, 0).toISOString().split("T")[0];

  // Get all active recurring expenses
  const { data: recurringExpenses } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!recurringExpenses || recurringExpenses.length === 0) {
    return { generated: 0, skipped: 0 };
  }

  // Get overrides for this month (table may not exist yet)
  let overridesMap = new Map();
  try {
    const { data: overrides } = await supabase
      .from("recurring_expense_overrides")
      .select("*")
      .eq("user_id", userId)
      .eq("override_month", monthStart);

    overridesMap = new Map(
      overrides?.map((o: { recurring_expense_id: string }) => [o.recurring_expense_id, o]) || []
    );
  } catch {
    // Table doesn't exist yet, continue without overrides
  }

  // Get existing generated transactions for this month
  let existingRecurringIds = new Set<string>();
  try {
    const { data: existingGenerated } = await supabase
      .from("transactions")
      .select("recurring_expense_id")
      .eq("user_id", userId)
      .eq("is_recurring_generated", true)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd);

    existingRecurringIds = new Set(
      existingGenerated?.map((t: { recurring_expense_id: string }) => t.recurring_expense_id) || []
    );
  } catch {
    // Column might not exist yet, check by recurring_expense_id only
    const { data: existingGenerated } = await supabase
      .from("transactions")
      .select("recurring_expense_id")
      .eq("user_id", userId)
      .not("recurring_expense_id", "is", null)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd);

    existingRecurringIds = new Set(
      existingGenerated?.map((t: { recurring_expense_id: string }) => t.recurring_expense_id) || []
    );
  }

  // Clean up generated planned transactions for expenses that are now skipped
  const skippedExpenseIds = recurringExpenses
    .filter((expense: { id: string }) => {
      const override = overridesMap.get(expense.id);
      return override?.is_skipped && existingRecurringIds.has(expense.id);
    })
    .map((expense: { id: string }) => expense.id);

  if (skippedExpenseIds.length > 0) {
    await supabase
      .from("transactions")
      .delete()
      .in("recurring_expense_id", skippedExpenseIds)
      .eq("user_id", userId)
      .eq("is_recurring_generated", true)
      .eq("payment_status", "planned")
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd);
  }

  // Filter to expenses that need to be generated
  const toGenerate = recurringExpenses.filter((expense: { 
    id: string; 
    interval_months: number; 
    start_date: string 
  }) => {
    if (!isExpenseDueInMonth(expense, year, month)) return false;
    if (existingRecurringIds.has(expense.id)) return false;
    const override = overridesMap.get(expense.id);
    if (override?.is_skipped) return false;
    return true;
  });

  if (toGenerate.length === 0) {
    return { generated: 0, skipped: existingRecurringIds.size };
  }

  // Get or create recurring account
  let account;
  const { data: existingAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("external_id", "recurring-generated")
    .single();

  if (existingAccount) {
    account = existingAccount;
  } else {
    const { data: newAccount } = await supabase
      .from("accounts")
      .insert({
        user_id: userId,
        external_id: "recurring-generated",
        name: "Wydatki cykliczne",
        currency: "PLN",
        balance: 0,
      })
      .select()
      .single();
    account = newAccount;
  }

  if (!account) {
    return { generated: 0, skipped: existingRecurringIds.size };
  }

  // Generate transactions
  // Due to the unique index, duplicate inserts will fail gracefully
  let generated = 0;

  for (const expense of toGenerate) {
    const override = overridesMap.get(expense.id);
    const dayOfMonth = expense.day_of_month || 1;
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const actualDay = Math.min(dayOfMonth, lastDayOfMonth);
    const transactionDate = `${monthStr}-${String(actualDay).padStart(2, "0")}`;

    const amount = override?.override_amount ?? expense.amount;

    // Insert transaction - unique index on (recurring_expense_id, generated_month) prevents duplicates
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
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
      generated_month: monthStr, // Used by unique index to prevent duplicates
    });

    if (!error) {
      generated++;
    }
    // If error is a unique constraint violation, that's fine - another process already inserted
  }

  return { generated, skipped: existingRecurringIds.size };
}
