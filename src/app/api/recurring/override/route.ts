import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

// POST/PUT - Create or update an override for a specific month
export async function POST(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recurringExpenseId, month, overrideAmount, isSkipped, isManuallyConfirmed, notes } =
      await request.json();

    if (!recurringExpenseId || !month) {
      return NextResponse.json(
        { error: "Recurring expense ID and month are required" },
        { status: 400 }
      );
    }

    // Verify the recurring expense belongs to the user
    const { data: expense, error: expenseError } = await supabase
      .from("recurring_expenses")
      .select("id")
      .eq("id", recurringExpenseId)
      .eq("user_id", user.id)
      .single();

    if (expenseError || !expense) {
      return NextResponse.json(
        { error: "Recurring expense not found" },
        { status: 404 }
      );
    }

    // Format month to first day (YYYY-MM-01)
    const overrideMonth = `${month}-01`;

    // Upsert the override
    const { data, error } = await supabase
      .from("recurring_expense_overrides")
      .upsert(
        {
          recurring_expense_id: recurringExpenseId,
          user_id: user.id,
          override_month: overrideMonth,
          override_amount: overrideAmount !== undefined ? overrideAmount : null,
          is_skipped: isSkipped || false,
          is_manually_confirmed: isManuallyConfirmed || false,
          notes: notes || null,
        },
        {
          onConflict: "recurring_expense_id,override_month",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error creating/updating override:", error);
      return NextResponse.json(
        { error: "Failed to save override" },
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

// DELETE - Remove an override
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
    const recurringExpenseId = searchParams.get("recurringExpenseId");
    const month = searchParams.get("month");

    if (!recurringExpenseId || !month) {
      return NextResponse.json(
        { error: "Recurring expense ID and month are required" },
        { status: 400 }
      );
    }

    const overrideMonth = `${month}-01`;

    const { error } = await supabase
      .from("recurring_expense_overrides")
      .delete()
      .eq("recurring_expense_id", recurringExpenseId)
      .eq("override_month", overrideMonth)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting override:", error);
      return NextResponse.json(
        { error: "Failed to delete override" },
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
