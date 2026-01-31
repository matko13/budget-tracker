import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

export async function PATCH(
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
    const { type, amount, categoryId, date, description, merchantName, isExcluded, paymentStatus } = body;

    // Verify the transaction belongs to the user
    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select("id, account_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    
    if (type !== undefined) {
      if (!["income", "expense"].includes(type)) {
        return NextResponse.json(
          { error: "Type must be 'income' or 'expense'" },
          { status: 400 }
        );
      }
      updateData.type = type;
    }
    
    if (amount !== undefined) {
      updateData.amount = Math.abs(parseFloat(amount));
    }
    
    if (categoryId !== undefined) {
      updateData.category_id = categoryId || null;
    }
    
    if (date !== undefined) {
      updateData.transaction_date = date;
      updateData.booking_date = date;
    }
    
    if (description !== undefined) {
      if (!description || description.trim() === "") {
        return NextResponse.json(
          { error: "Description is required" },
          { status: 400 }
        );
      }
      updateData.description = description;
    }
    
    if (merchantName !== undefined) {
      updateData.merchant_name = merchantName || null;
    }
    
    if (isExcluded !== undefined) {
      updateData.is_excluded = isExcluded;
    }
    
    if (paymentStatus !== undefined) {
      if (paymentStatus !== null && !["completed", "planned", "skipped"].includes(paymentStatus)) {
        return NextResponse.json(
          { error: "Payment status must be 'completed', 'planned', or 'skipped'" },
          { status: 400 }
        );
      }
      updateData.payment_status = paymentStatus;
    }

    // Update the transaction
    const { data: updatedTransaction, error: updateError } = await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", id)
      .select("*, categories(*), accounts(*)")
      .single();

    if (updateError) {
      console.error("Error updating transaction:", updateError);
      return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
    }

    return NextResponse.json(updatedTransaction);
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
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

    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("*, categories(*), accounts(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    // Verify the transaction belongs to the user
    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting transaction:", deleteError);
      return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
