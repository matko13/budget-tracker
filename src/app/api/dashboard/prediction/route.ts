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

    const oldestStart = historicalMonths[historicalMonths.length - 1].startDate;
    const newestEnd = historicalMonths[0].endDate;

    const { data: historicalTransactions } = await supabase
      .from("transactions")
      .select("amount, type, transaction_date, is_excluded")
      .eq("user_id", user.id)
      .or("payment_status.neq.skipped,payment_status.is.null")
      .gte("transaction_date", oldestStart)
      .lte("transaction_date", newestEnd);

    const expenses = (historicalTransactions || []).filter(
      (t: { type: string; is_excluded?: boolean }) =>
        t.type === "expense" && !t.is_excluded
    );

    const monthsWithData = historicalMonths.filter((m) =>
      expenses.some(
        (t: { transaction_date: string }) =>
          t.transaction_date >= m.startDate && t.transaction_date <= m.endDate
      )
    );

    const monthsAnalyzed = monthsWithData.length;
    if (monthsAnalyzed === 0) {
      return NextResponse.json({
        predictedRemainingExpenses: 0,
        avgDailyExpense: 0,
        remainingDays,
        monthsAnalyzed: 0,
      });
    }

    // Build per-day-of-month expense totals (day 1..31)
    const dayTotals: Record<number, { sum: number; monthCount: number }> = {};
    for (let d = 1; d <= 31; d++) {
      dayTotals[d] = { sum: 0, monthCount: 0 };
    }

    for (const m of monthsWithData) {
      for (let d = 1; d <= m.days; d++) {
        dayTotals[d].monthCount++;
      }
    }

    for (const t of expenses as { amount: number; transaction_date: string }[]) {
      const inRange = monthsWithData.some(
        (m) => t.transaction_date >= m.startDate && t.transaction_date <= m.endDate
      );
      if (!inRange) continue;
      const day = parseInt(t.transaction_date.split("-")[2], 10);
      dayTotals[day].sum += t.amount;
    }

    // Sum predicted expenses for each remaining day using per-day averages
    let predictedRemainingExpenses = 0;
    for (let d = currentDay + 1; d <= daysInMonth; d++) {
      const entry = dayTotals[d];
      if (entry && entry.monthCount > 0) {
        predictedRemainingExpenses += entry.sum / entry.monthCount;
      }
    }

    const totalExpenses = expenses.reduce(
      (sum: number, t: { amount: number }) => sum + t.amount,
      0
    );
    const effectiveDays = monthsWithData.reduce((sum, m) => sum + m.days, 0);
    const avgDailyExpense = effectiveDays > 0 ? totalExpenses / effectiveDays : 0;

    return NextResponse.json({
      predictedRemainingExpenses: Math.round(predictedRemainingExpenses * 100) / 100,
      avgDailyExpense: Math.round(avgDailyExpense * 100) / 100,
      remainingDays,
      monthsAnalyzed,
    });
  } catch (error) {
    console.error("Error computing prediction:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
