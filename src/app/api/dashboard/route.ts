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

// Auto-generate recurring expense transactions for a month if they don't exist
async function ensureRecurringTransactions(
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
    return;
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
      overrides?.map((o) => [o.recurring_expense_id, o]) || []
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
      existingGenerated?.map((t) => t.recurring_expense_id) || []
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
      existingGenerated?.map((t) => t.recurring_expense_id) || []
    );
  }

  // Filter to expenses that need to be generated
  const toGenerate = recurringExpenses.filter((expense) => {
    if (!isExpenseDueInMonth(expense, year, month)) return false;
    if (existingRecurringIds.has(expense.id)) return false;
    const override = overridesMap.get(expense.id);
    if (override?.is_skipped) return false;
    return true;
  });

  if (toGenerate.length === 0) return;

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

  if (!account) return;

  // Generate transactions
  for (const expense of toGenerate) {
    const override = overridesMap.get(expense.id);
    const dayOfMonth = expense.day_of_month || 1;
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const actualDay = Math.min(dayOfMonth, lastDayOfMonth);
    const transactionDate = `${monthStr}-${String(actualDay).padStart(2, "0")}`;

    const amount = override?.override_amount ?? expense.amount;

    // Always set as 'planned' for generated transactions - they are placeholders.
    // Status becomes 'completed' only when matched with a real bank transaction.
    await supabase.from("transactions").insert({
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
    });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse month/year from query params
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = parseInt(searchParams.get("month") || String(now.getMonth()));
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

    // Auto-generate recurring transactions for this month
    await ensureRecurringTransactions(supabase, user.id, year, month);

    // Get accounts
    const { data: accounts } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id);

    // Get selected month date range
    const startOfMonth = new Date(year, month, 1)
      .toISOString()
      .split("T")[0];
    const endOfMonth = new Date(year, month + 1, 0)
      .toISOString()
      .split("T")[0];

    // Get this month's transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*, categories(*)")
      .eq("user_id", user.id)
      .gte("transaction_date", startOfMonth)
      .lte("transaction_date", endOfMonth)
      .order("transaction_date", { ascending: false });

    // Calculate totals (excluding internal transfers)
    const totalBalance = accounts?.reduce((sum: number, acc: { balance: number }) => sum + (acc.balance || 0), 0) || 0;
    
    const monthlyIncome = transactions
      ?.filter((t: { type: string; is_excluded?: boolean }) => t.type === "income" && !t.is_excluded)
      .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0) || 0;
    
    const monthlyExpenses = transactions
      ?.filter((t: { type: string; is_excluded?: boolean }) => t.type === "expense" && !t.is_excluded)
      .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0) || 0;

    // Calculate spending by category (excluding internal transfers)
    const spendingByCategory: Record<string, { name: string; amount: number; color: string }> = {};
    
    transactions
      ?.filter((t: { type: string; is_excluded?: boolean }) => t.type === "expense" && !t.is_excluded)
      .forEach((t: { categories?: { name: string; color: string }; amount: number }) => {
        const categoryName = t.categories?.name || "Uncategorized";
        const categoryColor = t.categories?.color || "#94a3b8";
        
        if (!spendingByCategory[categoryName]) {
          spendingByCategory[categoryName] = { name: categoryName, amount: 0, color: categoryColor };
        }
        spendingByCategory[categoryName].amount += t.amount;
      });

    const categoryBreakdown = Object.values(spendingByCategory)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    // Get recent transactions
    const recentTransactions = transactions?.slice(0, 10) || [];

    // Get budgets with spending
    const { data: budgets } = await supabase
      .from("budgets")
      .select("*, categories(*)")
      .eq("user_id", user.id);

    // Calculate spending per category for budgets (excluding internal transfers)
    const spendingByCategoryId: Record<string, number> = {};
    transactions
      ?.filter((t: { type: string; is_excluded?: boolean }) => t.type === "expense" && !t.is_excluded)
      .forEach((t: { category_id: string | null; amount: number }) => {
        if (t.category_id) {
          spendingByCategoryId[t.category_id] = (spendingByCategoryId[t.category_id] || 0) + t.amount;
        }
      });

    const budgetsWithSpending = (budgets || []).map((budget: { id: string; category_id: string; amount: number; categories: { id: string; name: string; icon: string; color: string } }) => ({
      id: budget.id,
      categoryId: budget.category_id,
      categoryName: budget.categories?.name,
      categoryIcon: budget.categories?.icon,
      categoryColor: budget.categories?.color,
      budgetAmount: budget.amount,
      spent: spendingByCategoryId[budget.category_id] || 0,
      percentUsed: Math.round(((spendingByCategoryId[budget.category_id] || 0) / budget.amount) * 100),
    }));

    const selectedDate = new Date(year, month);
    const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();

    return NextResponse.json({
      accounts: accounts || [],
      totalBalance,
      monthlyIncome,
      monthlyExpenses,
      categoryBreakdown,
      recentTransactions,
      budgets: budgetsWithSpending,
      currentMonth: selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      month,
      year,
      isCurrentMonth,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
