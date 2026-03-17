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
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = daysInMonth - currentDay;

    // Get all accounts to calculate current total balance
    const { data: accounts } = await supabase
      .from("accounts")
      .select("balance")
      .eq("user_id", user.id);

    const currentBalance =
      accounts?.reduce((sum: number, a: { balance: number }) => sum + a.balance, 0) || 0;

    // Build date ranges for the last 3 complete months
    const historicalMonths: { startDate: string; endDate: string; days: number }[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const mm = String(m + 1).padStart(2, "0");
      const lastDay = new Date(y, m + 1, 0).getDate();
      historicalMonths.push({
        startDate: `${y}-${mm}-01`,
        endDate: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
        days: lastDay,
      });
    }

    const totalHistoricalDays = historicalMonths.reduce((sum, m) => sum + m.days, 0);
    const oldestStart = historicalMonths[historicalMonths.length - 1].startDate;
    const newestEnd = historicalMonths[0].endDate;

    // Fetch all transactions from the last 3 complete months (exclude skipped)
    const { data: historicalTransactions } = await supabase
      .from("transactions")
      .select("amount, type, transaction_date, is_excluded")
      .eq("user_id", user.id)
      .or("payment_status.neq.skipped,payment_status.is.null")
      .gte("transaction_date", oldestStart)
      .lte("transaction_date", newestEnd);

    const filtered = (historicalTransactions || []).filter(
      (t: { is_excluded?: boolean }) => !t.is_excluded
    );

    const totalExpenses = filtered
      .filter((t: { type: string }) => t.type === "expense")
      .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

    const totalIncome = filtered
      .filter((t: { type: string }) => t.type === "income")
      .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

    // Count months that actually had any transactions (to avoid skewing by empty months)
    const monthsWithData = historicalMonths.filter((m) =>
      filtered.some(
        (t: { transaction_date: string }) =>
          t.transaction_date >= m.startDate && t.transaction_date <= m.endDate
      )
    );

    const monthsAnalyzed = monthsWithData.length;
    const effectiveDays =
      monthsWithData.reduce((sum, m) => sum + m.days, 0) || totalHistoricalDays;

    const avgDailyExpense = effectiveDays > 0 ? totalExpenses / effectiveDays : 0;
    const avgDailyIncome = effectiveDays > 0 ? totalIncome / effectiveDays : 0;

    const predictedRemainingExpenses = avgDailyExpense * remainingDays;
    const predictedRemainingIncome = avgDailyIncome * remainingDays;
    const predictedBalance =
      currentBalance - predictedRemainingExpenses + predictedRemainingIncome;

    // Also compute current month's spending so far for context
    const cmm = String(now.getMonth() + 1).padStart(2, "0");
    const currentMonthStart = `${now.getFullYear()}-${cmm}-01`;
    const currentMonthEnd = `${now.getFullYear()}-${cmm}-${String(daysInMonth).padStart(2, "0")}`;

    const { data: currentMonthTransactions } = await supabase
      .from("transactions")
      .select("amount, type, is_excluded, payment_status")
      .eq("user_id", user.id)
      .or("payment_status.neq.skipped,payment_status.is.null")
      .gte("transaction_date", currentMonthStart)
      .lte("transaction_date", currentMonthEnd);

    const currentMonthFiltered = (currentMonthTransactions || []).filter(
      (t: { is_excluded?: boolean; payment_status?: string | null }) =>
        !t.is_excluded && t.payment_status !== "planned"
    );

    const currentMonthExpenses = currentMonthFiltered
      .filter((t: { type: string }) => t.type === "expense")
      .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

    const currentMonthActualDailyExpense =
      currentDay > 0 ? currentMonthExpenses / currentDay : 0;

    return NextResponse.json({
      currentBalance: Math.round(currentBalance * 100) / 100,
      predictedBalance: Math.round(predictedBalance * 100) / 100,
      avgDailyExpense: Math.round(avgDailyExpense * 100) / 100,
      avgDailyIncome: Math.round(avgDailyIncome * 100) / 100,
      currentMonthDailyExpense: Math.round(currentMonthActualDailyExpense * 100) / 100,
      remainingDays,
      daysInMonth,
      currentDay,
      monthsAnalyzed,
    });
  } catch (error) {
    console.error("Error computing prediction:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
