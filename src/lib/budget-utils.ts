import { createUntypedClient } from "@/lib/supabase/server-untyped";

// Helper to get first day of month in YYYY-MM-DD format
export function getMonthStart(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0];
}

// Helper to get previous month date
export function getPreviousMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

/**
 * Ensures budgets exist for the specified month.
 * If no budgets exist for the month, copies them from the previous month.
 */
export async function ensureBudgetsForMonth(
  supabase: Awaited<ReturnType<typeof createUntypedClient>>,
  userId: string,
  year: number,
  month: number // 0-indexed (0 = January)
): Promise<void> {
  const targetDate = new Date(year, month, 1);
  const targetMonthStart = getMonthStart(targetDate);
  
  // Check if budgets exist for target month
  const { count, error: checkError } = await supabase
    .from("budgets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("budget_month", targetMonthStart);

  if (checkError) {
    console.error("Error checking existing budgets:", checkError);
    return;
  }

  // If budgets already exist for this month, no need to copy
  if (count && count > 0) {
    return;
  }

  // Get budgets from previous month
  const previousMonthDate = getPreviousMonth(targetDate);
  const previousMonthStart = getMonthStart(previousMonthDate);

  const { data: previousBudgets, error: fetchError } = await supabase
    .from("budgets")
    .select("category_id, amount, period")
    .eq("user_id", userId)
    .eq("budget_month", previousMonthStart);

  if (fetchError || !previousBudgets || previousBudgets.length === 0) {
    // No previous budgets to copy
    return;
  }

  // Copy budgets to target month
  const newBudgets = previousBudgets.map((budget: { category_id: string; amount: number; period: string }) => ({
    user_id: userId,
    category_id: budget.category_id,
    amount: budget.amount,
    period: budget.period,
    budget_month: targetMonthStart,
  }));

  const { error: insertError } = await supabase
    .from("budgets")
    .insert(newBudgets);

  if (insertError) {
    console.error("Error copying budgets to new month:", insertError);
  }
}
