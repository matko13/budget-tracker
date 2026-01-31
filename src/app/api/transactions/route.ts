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
