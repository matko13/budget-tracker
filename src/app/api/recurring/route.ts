import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

// Helper to check if an expense is due in a specific month based on interval
function isExpenseDueInMonth(
  expense: {
    interval_months: number;
    start_date: string;
    last_occurrence_date: string | null;
  },
  targetYear: number,
  targetMonth: number
): boolean {
  const targetMonthNum = targetYear * 12 + targetMonth;
  
  // Check against start date
  const startDate = new Date(expense.start_date);
  const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
  const monthsSinceStart = targetMonthNum - startMonth;
  
  // Check if target month aligns with interval from start
  return monthsSinceStart >= 0 && monthsSinceStart % expense.interval_months === 0;
}

// Parse month string (YYYY-MM) or return current month
function parseMonth(monthStr: string | null): { year: number; month: number } {
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [year, month] = monthStr.split("-").map(Number);
    return { year, month: month - 1 }; // JS months are 0-indexed
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

// GET - List all recurring expenses with month status
export async function GET(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse month from query params (format: YYYY-MM)
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const { year, month } = parseMonth(monthParam);

    // Get all recurring expenses
    const { data: recurringExpenses, error } = await supabase
      .from("recurring_expenses")
      .select("*, categories(*)")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching recurring expenses:", error);
      return NextResponse.json(
        { error: "Failed to fetch recurring expenses" },
        { status: 500 }
      );
    }

    // Get target month's start and end dates
    const monthStart = new Date(year, month, 1).toISOString().split("T")[0];
    const monthEnd = new Date(year, month + 1, 0).toISOString().split("T")[0];
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}-01`; // For overrides lookup

    // Get overrides for this month
    const { data: overrides } = await supabase
      .from("recurring_expense_overrides")
      .select("*")
      .eq("user_id", user.id)
      .eq("override_month", monthKey);

    const overridesMap = new Map(
      overrides?.map((o) => [o.recurring_expense_id, o]) || []
    );

    // Get transactions linked to recurring expenses this month
    const { data: matchedTransactions } = await supabase
      .from("transactions")
      .select("id, recurring_expense_id, transaction_date, amount")
      .eq("user_id", user.id)
      .not("recurring_expense_id", "is", null)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd);

    // Map recurring expenses with their matched status and due status
    const matchedIds = new Set(
      matchedTransactions?.map((t) => t.recurring_expense_id) || []
    );

    // Current date for determining if due date has passed
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentDay = now.getDate();

    const expensesWithStatus = recurringExpenses?.map((expense) => {
      const override = overridesMap.get(expense.id);
      const isDueThisMonth = isExpenseDueInMonth(expense, year, month);
      const isSkipped = override?.is_skipped || false;
      const isManuallyConfirmed = override?.is_manually_confirmed || false;
      const effectiveAmount = override?.override_amount !== null && override?.override_amount !== undefined
        ? parseFloat(override.override_amount)
        : parseFloat(expense.amount);

      // Determine if the due date has passed
      const dayOfMonth = expense.day_of_month || 1;
      const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate();
      const actualDueDay = Math.min(dayOfMonth, lastDayOfTargetMonth);
      
      let isDueDatePassed = false;
      let isDueToday = false;
      
      if (year < currentYear) {
        // Past year - always passed
        isDueDatePassed = true;
      } else if (year === currentYear) {
        if (month < currentMonth) {
          // Past month in current year - always passed
          isDueDatePassed = true;
        } else if (month === currentMonth) {
          // Current month - check if day has passed or is today
          isDueDatePassed = actualDueDay < currentDay;
          isDueToday = actualDueDay === currentDay;
        }
        // Future month - not passed
      }
      // Future year - not passed

      // isPaidThisMonth is true ONLY if: has linked transaction OR manually confirmed
      // (NOT when due date has passed - that should show as overdue)
      const hasLinkedTransaction = matchedIds.has(expense.id);
      const isPaidThisMonth = hasLinkedTransaction || isManuallyConfirmed;
      
      // isOverdue is true if: due this month, due date passed, not paid, not skipped
      const isOverdue = isDueThisMonth && isDueDatePassed && !isPaidThisMonth && !isSkipped;

      return {
        ...expense,
        isDueThisMonth,
        isSkipped,
        isPaidThisMonth,
        isDueDatePassed,
        isDueToday,
        isOverdue,
        isManuallyConfirmed,
        hasLinkedTransaction,
        effectiveAmount,
        override: override || null,
        matchedTransaction: matchedTransactions?.find(
          (t) => t.recurring_expense_id === expense.id
        ),
      };
    });

    // Calculate totals - only for expenses due this month and not skipped
    const expensesDueThisMonth = expensesWithStatus?.filter(
      (e) => e.is_active && e.isDueThisMonth && !e.isSkipped
    );

    const totalDueThisMonth =
      expensesDueThisMonth?.reduce((sum, e) => sum + e.effectiveAmount, 0) || 0;

    const paidThisMonth =
      expensesDueThisMonth
        ?.filter((e) => e.isPaidThisMonth)
        .reduce((sum, e) => sum + e.effectiveAmount, 0) || 0;

    // Calculate overdue amount (due date passed but not paid)
    const overdueThisMonth =
      expensesDueThisMonth
        ?.filter((e) => e.isOverdue)
        .reduce((sum, e) => sum + e.effectiveAmount, 0) || 0;

    // Pending = upcoming (due date not yet passed and not paid)
    const pendingThisMonth =
      expensesDueThisMonth
        ?.filter((e) => !e.isPaidThisMonth && !e.isOverdue)
        .reduce((sum, e) => sum + e.effectiveAmount, 0) || 0;

    // Also calculate total monthly equivalent for reference
    const totalMonthlyEquivalent =
      recurringExpenses
        ?.filter((e) => e.is_active)
        .reduce((sum, e) => sum + parseFloat(e.amount) / (e.interval_months || 1), 0) || 0;

    return NextResponse.json({
      recurringExpenses: expensesWithStatus || [],
      totalDueThisMonth,
      totalMonthlyEquivalent: Math.round(totalMonthlyEquivalent * 100) / 100,
      paidThisMonth,
      overdueThisMonth,
      pendingThisMonth,
      selectedMonth: `${year}-${String(month + 1).padStart(2, "0")}`,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new recurring expense
export async function POST(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, amount, currency, categoryId, dayOfMonth, intervalMonths, matchKeywords } =
      await request.json();

    if (!name || !amount) {
      return NextResponse.json(
        { error: "Name and amount are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("recurring_expenses")
      .insert({
        user_id: user.id,
        name,
        amount,
        currency: currency || "PLN",
        category_id: categoryId || null,
        day_of_month: dayOfMonth || null,
        interval_months: intervalMonths || 1,
        match_keywords: matchKeywords || [],
        is_active: true,
      })
      .select("*, categories(*)")
      .single();

    if (error) {
      console.error("Error creating recurring expense:", error);
      return NextResponse.json(
        { error: "Failed to create recurring expense" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a recurring expense
export async function PUT(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      id,
      name,
      amount,
      currency,
      categoryId,
      dayOfMonth,
      intervalMonths,
      matchKeywords,
      isActive,
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Recurring expense ID is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (amount !== undefined) updateData.amount = amount;
    if (currency !== undefined) updateData.currency = currency;
    if (categoryId !== undefined) updateData.category_id = categoryId || null;
    if (dayOfMonth !== undefined) updateData.day_of_month = dayOfMonth || null;
    if (intervalMonths !== undefined) updateData.interval_months = intervalMonths;
    if (matchKeywords !== undefined) updateData.match_keywords = matchKeywords;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data, error } = await supabase
      .from("recurring_expenses")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, categories(*)")
      .single();

    if (error) {
      console.error("Error updating recurring expense:", error);
      return NextResponse.json(
        { error: "Failed to update recurring expense" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a recurring expense
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
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Recurring expense ID is required" },
        { status: 400 }
      );
    }

    // First, unlink any transactions
    await supabase
      .from("transactions")
      .update({ recurring_expense_id: null })
      .eq("recurring_expense_id", id)
      .eq("user_id", user.id);

    // Then delete the recurring expense
    const { error } = await supabase
      .from("recurring_expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting recurring expense:", error);
      return NextResponse.json(
        { error: "Failed to delete recurring expense" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
