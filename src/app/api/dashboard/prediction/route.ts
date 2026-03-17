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

    const filtered = (historicalTransactions || []).filter(
      (t: { is_excluded?: boolean }) => !t.is_excluded
    );

    const totalExpenses = filtered
      .filter((t: { type: string }) => t.type === "expense")
      .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

    const monthsWithData = historicalMonths.filter((m) =>
      filtered.some(
        (t: { transaction_date: string }) =>
          t.transaction_date >= m.startDate && t.transaction_date <= m.endDate
      )
    );

    const monthsAnalyzed = monthsWithData.length;
    const effectiveDays = monthsWithData.reduce((sum, m) => sum + m.days, 0);

    const avgDailyExpense = effectiveDays > 0 ? totalExpenses / effectiveDays : 0;

    return NextResponse.json({
      avgDailyExpense: Math.round(avgDailyExpense * 100) / 100,
      remainingDays,
      monthsAnalyzed,
    });
  } catch (error) {
    console.error("Error computing prediction:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
