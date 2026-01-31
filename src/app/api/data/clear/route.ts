import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

export async function POST() {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete in order due to foreign key constraints
    // 1. Delete transactions
    await supabase.from("transactions").delete().eq("user_id", user.id);

    // 2. Delete budgets
    await supabase.from("budgets").delete().eq("user_id", user.id);

    // 3. Delete categorization rules (user's custom ones)
    await supabase.from("categorization_rules").delete().eq("user_id", user.id);

    // 4. Delete accounts
    await supabase.from("accounts").delete().eq("user_id", user.id);

    // 5. Delete custom categories
    await supabase.from("categories").delete().eq("user_id", user.id);

    return NextResponse.json({ success: true, message: "All data cleared" });
  } catch (error) {
    console.error("Error clearing data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
