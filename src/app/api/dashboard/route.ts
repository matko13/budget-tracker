import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";
import { ensureRecurringTransactions } from "@/lib/recurring-transactions";
import { ensureBudgetsForMonth } from "@/lib/budget-utils";

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

    // Auto-copy budgets from previous month if none exist for this month
    await ensureBudgetsForMonth(supabase, user.id, year, month);

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

    // Get budgets with spending for the selected month
    const budgetMonth = new Date(year, month, 1).toISOString().split("T")[0];
    const { data: budgets } = await supabase
      .from("budgets")
      .select("*, categories(*)")
      .eq("user_id", user.id)
      .eq("budget_month", budgetMonth);

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

    // Calculate monthly balance and savings rate
    const monthlyBalance = monthlyIncome - monthlyExpenses;
    const savingsRate = monthlyIncome > 0 ? Math.round((monthlyBalance / monthlyIncome) * 100) : 0;

    return NextResponse.json({
      accounts: accounts || [],
      monthlyBalance,
      savingsRate,
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
