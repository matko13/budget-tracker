import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

// Helper to get first day of month in YYYY-MM-DD format
function getMonthStart(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0];
}

// Helper to get previous month date
function getPreviousMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

export async function POST(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { month } = await request.json();

    // Parse target month or default to current month
    let targetDate: Date;
    if (month) {
      const [year, monthNum] = month.split("-").map(Number);
      targetDate = new Date(year, monthNum - 1, 1);
    } else {
      targetDate = new Date();
    }

    const targetMonthStart = getMonthStart(targetDate);
    const previousMonthDate = getPreviousMonth(targetDate);
    const previousMonthStart = getMonthStart(previousMonthDate);

    // Get budgets from previous month
    const { data: previousBudgets, error: fetchError } = await supabase
      .from("budgets")
      .select("category_id, amount, period")
      .eq("user_id", user.id)
      .eq("budget_month", previousMonthStart);

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch previous month budgets" }, { status: 500 });
    }

    if (!previousBudgets || previousBudgets.length === 0) {
      return NextResponse.json({ error: "No budgets found in previous month" }, { status: 404 });
    }

    // Get existing budgets in target month to avoid duplicates
    const { data: existingBudgets } = await supabase
      .from("budgets")
      .select("category_id")
      .eq("user_id", user.id)
      .eq("budget_month", targetMonthStart);

    const existingCategoryIds = new Set((existingBudgets || []).map((b: { category_id: string }) => b.category_id));

    // Filter out budgets that already exist in target month
    const budgetsToCopy = previousBudgets.filter(
      (b: { category_id: string }) => !existingCategoryIds.has(b.category_id)
    );

    if (budgetsToCopy.length === 0) {
      return NextResponse.json({ 
        message: "All budgets already exist in target month",
        copied: 0 
      });
    }

    // Create new budgets for target month
    const newBudgets = budgetsToCopy.map((budget: { category_id: string; amount: number; period: string }) => ({
      user_id: user.id,
      category_id: budget.category_id,
      amount: budget.amount,
      period: budget.period,
      budget_month: targetMonthStart,
    }));

    const { data: createdBudgets, error: insertError } = await supabase
      .from("budgets")
      .insert(newBudgets)
      .select("*, categories(*)");

    if (insertError) {
      return NextResponse.json({ error: "Failed to copy budgets" }, { status: 500 });
    }

    return NextResponse.json({
      message: `Successfully copied ${createdBudgets?.length || 0} budgets`,
      copied: createdBudgets?.length || 0,
      budgets: createdBudgets,
    });
  } catch (error) {
    console.error("Error copying budgets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
