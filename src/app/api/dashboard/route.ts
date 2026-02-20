import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";
import { ensureRecurringTransactions } from "@/lib/recurring-transactions";

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
    const hidePlanned = searchParams.get("hidePlanned") === "true";

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

    // Get this month's transactions (exclude skipped)
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*, categories(*)")
      .eq("user_id", user.id)
      .neq("payment_status", "skipped")
      .gte("transaction_date", startOfMonth)
      .lte("transaction_date", endOfMonth)
      .order("transaction_date", { ascending: false });

    // Calculate totals (excluding internal transfers)
    const monthlyIncome = transactions
      ?.filter((t: { type: string; is_excluded?: boolean }) => t.type === "income" && !t.is_excluded)
      .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0) || 0;
    
    // Calculate real expenses (completed transactions, not planned)
    const realExpenses = transactions
      ?.filter((t: { type: string; is_excluded?: boolean; payment_status?: string | null }) => 
        t.type === "expense" && !t.is_excluded && t.payment_status !== "planned"
      )
      .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0) || 0;
    
    // Calculate planned expenses (transactions with payment_status = "planned")
    const plannedExpenses = transactions
      ?.filter((t: { type: string; is_excluded?: boolean; payment_status?: string | null }) => 
        t.type === "expense" && !t.is_excluded && t.payment_status === "planned"
      )
      .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0) || 0;
    
    // Total expenses (for backward compatibility)
    const monthlyExpenses = realExpenses + plannedExpenses;

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

    // Get recent transactions (optionally filter out planned recurring)
    let recentTransactions = transactions || [];
    if (hidePlanned) {
      recentTransactions = recentTransactions.filter(
        (t: { is_recurring_generated: boolean; payment_status: string | null }) => 
          !t.is_recurring_generated || t.payment_status !== "planned"
      );
    }
    recentTransactions = recentTransactions.slice(0, 10);

    const selectedDate = new Date(year, month);
    const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();

    // Calculate monthly balance and savings rate
    const monthlyBalance = monthlyIncome - monthlyExpenses;
    const realBalance = monthlyIncome - realExpenses;
    const savingsRate = monthlyIncome > 0 ? Math.round((monthlyBalance / monthlyIncome) * 100) : 0;
    const realSavingsRate = monthlyIncome > 0 ? Math.round((realBalance / monthlyIncome) * 100) : 0;

    return NextResponse.json({
      accounts: accounts || [],
      monthlyBalance,
      realBalance,
      savingsRate,
      realSavingsRate,
      monthlyIncome,
      monthlyExpenses,
      realExpenses,
      plannedExpenses,
      categoryBreakdown,
      recentTransactions,
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
