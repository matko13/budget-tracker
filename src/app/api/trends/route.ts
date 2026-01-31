import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

export async function GET() {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    
    // Get last 6 months of data
    const months: { month: string; year: number; startDate: string; endDate: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = date.toISOString().split("T")[0];
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0];
      months.push({
        month: date.toLocaleDateString("en-US", { month: "short" }),
        year: date.getFullYear(),
        startDate,
        endDate,
      });
    }

    // Fetch all transactions for the last 6 months
    const sixMonthsAgo = months[0].startDate;
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount, type, transaction_date, category_id, categories(name, color)")
      .eq("user_id", user.id)
      .gte("transaction_date", sixMonthsAgo)
      .order("transaction_date", { ascending: true });

    // Calculate monthly totals
    const monthlyData = months.map(({ month, year, startDate, endDate }) => {
      const monthTransactions = (transactions || []).filter(
        (t: { transaction_date: string }) =>
          t.transaction_date >= startDate && t.transaction_date <= endDate
      );

      const income = monthTransactions
        .filter((t: { type: string }) => t.type === "income")
        .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

      const expenses = monthTransactions
        .filter((t: { type: string }) => t.type === "expense")
        .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

      return {
        name: `${month} ${year !== now.getFullYear() ? year : ""}`.trim(),
        income: Math.round(income),
        expenses: Math.round(expenses),
        net: Math.round(income - expenses),
      };
    });

    // Calculate daily spending for current month
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    const dailyData: { day: number; amount: number }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(now.getFullYear(), now.getMonth(), day).toISOString().split("T")[0];
      const dayExpenses = (transactions || [])
        .filter(
          (t: { type: string; transaction_date: string }) =>
            t.type === "expense" && t.transaction_date === dayDate
        )
        .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);
      
      dailyData.push({ day, amount: Math.round(dayExpenses) });
    }

    // Calculate category trends (current month vs last month)
    const currentMonthStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const currentMonthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    const lastMonthStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    const lastMonthEndDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

    const categoryTrends: Record<string, { name: string; color: string; current: number; previous: number }> = {};

    (transactions || [])
      .filter((t: { type: string }) => t.type === "expense")
      .forEach((t: { transaction_date: string; amount: number; categories?: { name: string; color: string } }) => {
        const categoryName = t.categories?.name || "Uncategorized";
        const categoryColor = t.categories?.color || "#94a3b8";

        if (!categoryTrends[categoryName]) {
          categoryTrends[categoryName] = { name: categoryName, color: categoryColor, current: 0, previous: 0 };
        }

        if (t.transaction_date >= currentMonthStartDate && t.transaction_date <= currentMonthEndDate) {
          categoryTrends[categoryName].current += t.amount;
        } else if (t.transaction_date >= lastMonthStartDate && t.transaction_date <= lastMonthEndDate) {
          categoryTrends[categoryName].previous += t.amount;
        }
      });

    const categoryComparison = Object.values(categoryTrends)
      .map((c) => ({
        ...c,
        current: Math.round(c.current),
        previous: Math.round(c.previous),
        change: c.previous > 0 ? Math.round(((c.current - c.previous) / c.previous) * 100) : 0,
      }))
      .sort((a, b) => b.current - a.current)
      .slice(0, 8);

    return NextResponse.json({
      monthlyData,
      dailyData,
      categoryComparison,
      currentMonth: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    });
  } catch (error) {
    console.error("Error fetching trends:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
