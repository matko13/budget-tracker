import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";
import { ensureBudgetsForMonth } from "@/lib/budget-utils";

// Helper to get first day of month in YYYY-MM-DD format
function getMonthStart(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0];
}

// Helper to get last day of month in YYYY-MM-DD format
function getMonthEnd(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0];
}

// Helper to get previous month date
function getPreviousMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
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

    // Parse month from query params (format: YYYY-MM), defaults to current month
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    
    let targetDate: Date;
    if (monthParam) {
      const [year, month] = monthParam.split("-").map(Number);
      targetDate = new Date(year, month - 1, 1);
    } else {
      targetDate = new Date();
    }

    const budgetMonth = getMonthStart(targetDate);
    const startOfMonth = getMonthStart(targetDate);
    const endOfMonth = getMonthEnd(targetDate);

    // Auto-copy budgets from previous month if none exist for this month
    await ensureBudgetsForMonth(supabase, user.id, targetDate.getFullYear(), targetDate.getMonth());

    // Get budgets for the specified month with category info
    const { data: budgets, error } = await supabase
      .from("budgets")
      .select("*, categories(*)")
      .eq("user_id", user.id)
      .eq("budget_month", budgetMonth);

    if (error) {
      console.error("Supabase error fetching budgets:", error);
      if (error.message?.includes("budget_month")) {
        return NextResponse.json({ 
          error: "Database migration required: budget_month column not found. Please run the migration." 
        }, { status: 500 });
      }
      return NextResponse.json({ error: `Failed to fetch budgets: ${error.message}` }, { status: 500 });
    }

    // Get spending for the specified month
    const { data: transactions } = await supabase
      .from("transactions")
      .select("category_id, amount, type")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .neq("payment_status", "skipped")
      .gte("transaction_date", startOfMonth)
      .lte("transaction_date", endOfMonth);

    // Calculate spending per category
    const spendingByCategory: Record<string, number> = {};
    (transactions || []).forEach((tx: { category_id: string | null; amount: number }) => {
      if (tx.category_id) {
        spendingByCategory[tx.category_id] = (spendingByCategory[tx.category_id] || 0) + tx.amount;
      }
    });

    // Check if previous month has budgets (for copy feature)
    const previousMonthDate = getPreviousMonth(targetDate);
    const previousMonthStart = getMonthStart(previousMonthDate);
    
    const { count: previousMonthBudgetCount } = await supabase
      .from("budgets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("budget_month", previousMonthStart);

    // Combine budgets with spending
    const budgetsWithSpending = (budgets || []).map((budget: { id: string; category_id: string; amount: number; period: string; budget_month: string; categories: { id: string; name: string; icon: string; color: string } }) => ({
      ...budget,
      spent: spendingByCategory[budget.category_id] || 0,
      remaining: budget.amount - (spendingByCategory[budget.category_id] || 0),
      percentUsed: Math.round(((spendingByCategory[budget.category_id] || 0) / budget.amount) * 100),
    }));

    // Calculate summary totals
    const totalBudgeted = budgetsWithSpending.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0);
    const totalSpent = budgetsWithSpending.reduce((sum: number, b: { spent: number }) => sum + b.spent, 0);
    const totalRemaining = totalBudgeted - totalSpent;
    const overallPercentUsed = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

    // Calculate unbudgeted expenses (expenses in categories without a budget)
    const budgetedCategoryIds = new Set(budgetsWithSpending.map((b: { category_id: string }) => b.category_id));
    const unbudgetedExpenses = Object.entries(spendingByCategory)
      .filter(([categoryId]) => !budgetedCategoryIds.has(categoryId))
      .reduce((sum, [, amount]) => sum + amount, 0);

    return NextResponse.json({
      budgets: budgetsWithSpending,
      month: budgetMonth,
      hasPreviousMonthBudgets: (previousMonthBudgetCount || 0) > 0,
      summary: {
        totalBudgeted,
        totalSpent,
        totalRemaining,
        overallPercentUsed,
        unbudgetedExpenses,
        budgetCount: budgetsWithSpending.length,
      },
    });
  } catch (error) {
    console.error("Error fetching budgets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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

    const { categoryId, amount, period = "monthly", month } = await request.json();

    if (!categoryId || !amount) {
      return NextResponse.json({ error: "Category and amount are required" }, { status: 400 });
    }

    // Parse the month or default to current month
    let budgetMonth: string;
    if (month) {
      const [year, monthNum] = month.split("-").map(Number);
      budgetMonth = getMonthStart(new Date(year, monthNum - 1, 1));
    } else {
      budgetMonth = getMonthStart(new Date());
    }

    // Check if budget already exists for this category and month
    const { data: existing } = await supabase
      .from("budgets")
      .select("id")
      .eq("user_id", user.id)
      .eq("category_id", categoryId)
      .eq("budget_month", budgetMonth)
      .single();

    if (existing) {
      // Update existing budget
      const { data: budget, error } = await supabase
        .from("budgets")
        .update({ amount })
        .eq("id", existing.id)
        .select("*, categories(*)")
        .single();

      if (error) {
        return NextResponse.json({ error: "Failed to update budget" }, { status: 500 });
      }

      return NextResponse.json(budget);
    }

    // Create new budget
    const { data: budget, error } = await supabase
      .from("budgets")
      .insert({
        user_id: user.id,
        category_id: categoryId,
        amount,
        period,
        budget_month: budgetMonth,
      })
      .select("*, categories(*)")
      .single();

    if (error) {
      console.error("Supabase error creating budget:", error);
      // Check for common errors
      if (error.message?.includes("budget_month")) {
        return NextResponse.json({ 
          error: "Database migration required: budget_month column not found. Please run the migration in supabase/migrations/add_budget_month.sql" 
        }, { status: 500 });
      }
      return NextResponse.json({ error: `Failed to create budget: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json(budget);
  } catch (error) {
    console.error("Error creating budget:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, amount } = await request.json();

    if (!id || amount === undefined) {
      return NextResponse.json({ error: "Budget ID and amount are required" }, { status: 400 });
    }

    const { data: budget, error } = await supabase
      .from("budgets")
      .update({ amount })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, categories(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update budget" }, { status: 500 });
    }

    return NextResponse.json(budget);
  } catch (error) {
    console.error("Error updating budget:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const budgetId = searchParams.get("id");

    if (!budgetId) {
      return NextResponse.json({ error: "Budget ID is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("id", budgetId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete budget" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting budget:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
