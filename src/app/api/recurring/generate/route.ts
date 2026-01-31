import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";
import { ensureRecurringTransactions } from "@/lib/recurring-transactions";

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

    const { generated, skipped } = await ensureRecurringTransactions(
      supabase,
      user.id,
      year,
      targetMonth
    );

    return NextResponse.json({
      success: true,
      generated,
      skippedExisting: skipped,
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
