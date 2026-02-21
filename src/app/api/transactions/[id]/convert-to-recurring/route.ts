import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, amount, currency, categoryId, dayOfMonth, intervalMonths, matchKeywords } = body;

    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select("*, categories(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.recurring_expense_id) {
      return NextResponse.json(
        { error: "Ta transakcja jest już powiązana z wydatkiem cyklicznym" },
        { status: 400 }
      );
    }

    const txDate = new Date(transaction.transaction_date);
    const resolvedName = name || transaction.merchant_name || transaction.description;
    const resolvedAmount = amount ?? transaction.amount;
    const resolvedCurrency = currency || transaction.currency || "PLN";
    const resolvedCategoryId = categoryId !== undefined ? (categoryId || null) : (transaction.category_id || null);
    const resolvedDay = dayOfMonth ?? txDate.getDate();
    const resolvedInterval = intervalMonths ?? 1;
    const resolvedKeywords = matchKeywords ?? [];

    const startDate = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}-01`;

    const { data: recurringExpense, error: createError } = await supabase
      .from("recurring_expenses")
      .insert({
        user_id: user.id,
        name: resolvedName,
        amount: Math.abs(parseFloat(resolvedAmount)),
        currency: resolvedCurrency,
        category_id: resolvedCategoryId,
        day_of_month: resolvedDay,
        interval_months: resolvedInterval,
        start_date: startDate,
        match_keywords: resolvedKeywords,
        is_active: true,
      })
      .select("*, categories(*)")
      .single();

    if (createError) {
      console.error("Error creating recurring expense:", createError);
      return NextResponse.json(
        { error: "Nie udało się utworzyć wydatku cyklicznego" },
        { status: 500 }
      );
    }

    const { error: linkError } = await supabase
      .from("transactions")
      .update({
        recurring_expense_id: recurringExpense.id,
        payment_status: "completed",
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (linkError) {
      console.error("Error linking transaction:", linkError);
    }

    return NextResponse.json({
      recurringExpense,
      linkedTransactionId: id,
    });
  } catch (error) {
    console.error("Error converting to recurring:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
