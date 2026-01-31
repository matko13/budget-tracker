import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

export async function POST(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, amount, categoryId, accountId, date, description, merchantName, isExcluded } = body;

    // Validate required fields
    if (!type || !amount || !date || !description) {
      return NextResponse.json(
        { error: "Missing required fields: type, amount, date, description" },
        { status: 400 }
      );
    }

    if (!["income", "expense"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'income' or 'expense'" },
        { status: 400 }
      );
    }

    // Use provided account or get/create default manual entry account
    let account;
    
    if (accountId) {
      // Verify account belongs to user
      const { data: userAccount } = await supabase
        .from("accounts")
        .select("id, currency")
        .eq("id", accountId)
        .eq("user_id", user.id)
        .single();
      
      if (userAccount) {
        account = userAccount;
      }
    }
    
    if (!account) {
      // Get or create default manual entry account
      const { data: existingAccount } = await supabase
        .from("accounts")
        .select("id, currency")
        .eq("user_id", user.id)
        .eq("external_id", "manual-entry")
        .single();

      if (existingAccount) {
        account = existingAccount;
      } else {
        // Create manual entry account
        const { data: newAccount, error: accountError } = await supabase
          .from("accounts")
          .insert({
            user_id: user.id,
            external_id: "manual-entry",
            name: "Manual Entries",
            currency: "PLN",
            balance: 0,
          })
          .select("id, currency")
          .single();

        if (accountError) {
          console.error("Account error:", accountError);
          return NextResponse.json(
            { error: "Failed to create manual entry account" },
            { status: 500 }
          );
        }

        account = newAccount;
      }
    }

    // Create the transaction
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: account.id,
        external_id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        amount: Math.abs(parseFloat(amount)),
        currency: account.currency || "PLN",
        description,
        merchant_name: merchantName || null,
        category_id: categoryId || null,
        transaction_date: date,
        booking_date: date,
        type,
        is_excluded: isExcluded || false,
      })
      .select("*, categories(*)")
      .single();

    if (txError) {
      console.error("Transaction error:", txError);
      return NextResponse.json(
        { error: "Failed to create transaction" },
        { status: 500 }
      );
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
