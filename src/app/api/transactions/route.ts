import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

// Helper to check if an expense is due in a specific month based on interval
function isExpenseDueInMonth(
  expense: {
    interval_months: number;
    start_date: string;
  },
  targetYear: number,
  targetMonth: number
): boolean {
  const targetMonthNum = targetYear * 12 + targetMonth;
  const startDate = new Date(expense.start_date);
  const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
  const monthsSinceStart = targetMonthNum - startMonth;

  return monthsSinceStart >= 0 && monthsSinceStart % expense.interval_months === 0;
}

// Auto-generate recurring expense transactions for a month if they don't exist
async function ensureRecurringTransactions(
  supabase: Awaited<ReturnType<typeof createUntypedClient>>,
  userId: string,
  year: number,
  month: number // 0-indexed
) {
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthStart = `${monthStr}-01`;
  const monthEnd = new Date(year, month + 1, 0).toISOString().split("T")[0];

  // Get all active recurring expenses
  const { data: recurringExpenses } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!recurringExpenses || recurringExpenses.length === 0) {
    return;
  }

  // Get overrides for this month (table may not exist yet)
  let overridesMap = new Map();
  try {
    const { data: overrides } = await supabase
      .from("recurring_expense_overrides")
      .select("*")
      .eq("user_id", userId)
      .eq("override_month", monthStart);

    overridesMap = new Map(
      overrides?.map((o) => [o.recurring_expense_id, o]) || []
    );
  } catch {
    // Table doesn't exist yet, continue without overrides
  }

  // Get existing generated transactions for this month
  let existingRecurringIds = new Set<string>();
  try {
    const { data: existingGenerated } = await supabase
      .from("transactions")
      .select("recurring_expense_id")
      .eq("user_id", userId)
      .eq("is_recurring_generated", true)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd);

    existingRecurringIds = new Set(
      existingGenerated?.map((t) => t.recurring_expense_id) || []
    );
  } catch {
    // Column might not exist yet, check by recurring_expense_id only
    const { data: existingGenerated } = await supabase
      .from("transactions")
      .select("recurring_expense_id")
      .eq("user_id", userId)
      .not("recurring_expense_id", "is", null)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd);

    existingRecurringIds = new Set(
      existingGenerated?.map((t) => t.recurring_expense_id) || []
    );
  }

  // Filter to expenses that need to be generated
  const toGenerate = recurringExpenses.filter((expense) => {
    if (!isExpenseDueInMonth(expense, year, month)) return false;
    if (existingRecurringIds.has(expense.id)) return false;
    const override = overridesMap.get(expense.id);
    if (override?.is_skipped) return false;
    return true;
  });

  if (toGenerate.length === 0) return;

  // Get or create recurring account
  let account;
  const { data: existingAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("external_id", "recurring-generated")
    .single();

  if (existingAccount) {
    account = existingAccount;
  } else {
    const { data: newAccount } = await supabase
      .from("accounts")
      .insert({
        user_id: userId,
        external_id: "recurring-generated",
        name: "Wydatki cykliczne",
        currency: "PLN",
        balance: 0,
      })
      .select()
      .single();
    account = newAccount;
  }

  if (!account) return;

  // Generate transactions
  for (const expense of toGenerate) {
    const override = overridesMap.get(expense.id);
    const dayOfMonth = expense.day_of_month || 1;
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const actualDay = Math.min(dayOfMonth, lastDayOfMonth);
    const transactionDate = `${monthStr}-${String(actualDay).padStart(2, "0")}`;

    const amount = override?.override_amount ?? expense.amount;

    // Always set as 'planned' for generated transactions - they are placeholders.
    // Status becomes 'completed' only when matched with a real bank transaction.
    await supabase.from("transactions").insert({
      user_id: userId,
      account_id: account.id,
      external_id: null,
      amount: Math.abs(parseFloat(amount)),
      currency: expense.currency,
      description: expense.name,
      merchant_name: expense.name,
      category_id: expense.category_id,
      recurring_expense_id: expense.id,
      transaction_date: transactionDate,
      booking_date: transactionDate,
      type: "expense",
      is_recurring_generated: true,
      payment_status: "planned",
    });
  }
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const categoryId = searchParams.get("category");
    const accountId = searchParams.get("account");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Auto-generate recurring transactions for the requested month range
    if (startDate) {
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : start;
      
      // Generate for each month in the range
      const startMonth = start.getFullYear() * 12 + start.getMonth();
      const endMonth = end.getFullYear() * 12 + end.getMonth();
      
      for (let m = startMonth; m <= endMonth; m++) {
        const year = Math.floor(m / 12);
        const month = m % 12;
        await ensureRecurringTransactions(supabase, user.id, year, month);
      }
    }

    const offset = (page - 1) * limit;

    let query = supabase
      .from("transactions")
      .select("*, categories(*), accounts(name, iban)", { count: "exact" })
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }
    if (accountId) {
      query = query.eq("account_id", accountId);
    }
    // Filter by type - ensure exact match with database enum values
    if (type && ["income", "expense", "transfer"].includes(type)) {
      query = query.eq("type", type);
    }
    if (search) {
      query = query.or(`description.ilike.%${search}%,merchant_name.ilike.%${search}%`);
    }
    if (startDate) {
      query = query.gte("transaction_date", startDate);
    }
    if (endDate) {
      query = query.lte("transaction_date", endDate);
    }

    const { data: transactions, count, error } = await query;

    if (error) {
      console.error("Query error:", error);
      return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
    }

    return NextResponse.json({
      transactions: transactions || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      filters: { type, categoryId, search, startDate, endDate },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
