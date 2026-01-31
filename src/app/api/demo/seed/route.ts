import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

// Demo transaction data for testing the app
const demoTransactions = [
  { description: "Biedronka - zakupy", merchant: "BIEDRONKA", amount: -156.78, type: "expense", daysAgo: 1 },
  { description: "Wynagrodzenie styczeń", merchant: "ACME Corp", amount: 8500.00, type: "income", daysAgo: 2 },
  { description: "Netflix subscription", merchant: "NETFLIX", amount: -52.99, type: "expense", daysAgo: 3 },
  { description: "Lidl - zakupy spożywcze", merchant: "LIDL", amount: -234.56, type: "expense", daysAgo: 4 },
  { description: "Uber - przejazd", merchant: "UBER", amount: -45.00, type: "expense", daysAgo: 5 },
  { description: "Allegro - elektronika", merchant: "ALLEGRO", amount: -899.00, type: "expense", daysAgo: 6 },
  { description: "Żabka - przekąski", merchant: "ZABKA", amount: -28.50, type: "expense", daysAgo: 7 },
  { description: "Spotify Premium", merchant: "SPOTIFY", amount: -29.99, type: "expense", daysAgo: 8 },
  { description: "McDonald's", merchant: "MCDONALDS", amount: -42.90, type: "expense", daysAgo: 9 },
  { description: "Orlen - paliwo", merchant: "ORLEN", amount: -320.00, type: "expense", daysAgo: 10 },
  { description: "Rossmann - kosmetyki", merchant: "ROSSMANN", amount: -89.99, type: "expense", daysAgo: 11 },
  { description: "Orange - telefon", merchant: "ORANGE", amount: -79.00, type: "expense", daysAgo: 12 },
  { description: "Zalando - ubrania", merchant: "ZALANDO", amount: -299.00, type: "expense", daysAgo: 13 },
  { description: "Starbucks", merchant: "STARBUCKS", amount: -32.00, type: "expense", daysAgo: 14 },
  { description: "Przelew od rodziny", merchant: null, amount: 500.00, type: "income", daysAgo: 15 },
  { description: "Carrefour - zakupy", merchant: "CARREFOUR", amount: -412.33, type: "expense", daysAgo: 16 },
  { description: "Glovo - jedzenie", merchant: "GLOVO", amount: -67.80, type: "expense", daysAgo: 17 },
  { description: "IKEA - meble", merchant: "IKEA", amount: -1299.00, type: "expense", daysAgo: 18 },
  { description: "Medicover - wizyta", merchant: "MEDICOVER", amount: -200.00, type: "expense", daysAgo: 19 },
  { description: "Zwrot podatku", merchant: "US", amount: 1250.00, type: "income", daysAgo: 20 },
  { description: "Apteka - leki", merchant: "APTEKA", amount: -78.50, type: "expense", daysAgo: 21 },
  { description: "PKP - bilet", merchant: "PKP", amount: -156.00, type: "expense", daysAgo: 22 },
  { description: "Multikino - kino", merchant: "MULTIKINO", amount: -65.00, type: "expense", daysAgo: 23 },
  { description: "Pyszne.pl - dostawa", merchant: "PYSZNE", amount: -89.00, type: "expense", daysAgo: 24 },
  { description: "Freelance project", merchant: "Client XYZ", amount: 2500.00, type: "income", daysAgo: 25 },
];

export async function POST() {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if demo data already exists
    const { data: existingAccounts } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id);

    if (existingAccounts && existingAccounts.length > 0) {
      return NextResponse.json({ 
        message: "Demo data already exists",
        accounts: existingAccounts.length 
      });
    }

    // Create a demo account
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .insert({
        user_id: user.id,
        external_id: "demo-account-" + Date.now(),
        iban: "PL61 1090 1014 0000 0712 1981 2874",
        name: "Konto Direct (Demo)",
        currency: "PLN",
        balance: 12847.52,
        balance_updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (accountError) {
      console.error("Account error:", accountError);
      return NextResponse.json({ error: "Failed to create demo account" }, { status: 500 });
    }

    // Get categories for auto-categorization
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name")
      .eq("is_system", true);

    const categoryMap: Record<string, string> = {};
    categories?.forEach((c: { id: string; name: string }) => {
      categoryMap[c.name] = c.id;
    });

    // Get categorization rules
    const { data: rules } = await supabase
      .from("categorization_rules")
      .select("keyword, category_id")
      .eq("is_system", true);

    // Function to find category
    const findCategory = (merchant: string | null, description: string) => {
      const searchText = `${merchant || ""} ${description}`.toLowerCase();
      for (const rule of rules || []) {
        if (searchText.includes(rule.keyword.toLowerCase())) {
          return rule.category_id;
        }
      }
      return categoryMap["Other"] || null;
    };

    // Insert demo transactions
    const transactionsToInsert = demoTransactions.map((t, index) => {
      const date = new Date();
      date.setDate(date.getDate() - t.daysAgo);
      
      return {
        user_id: user.id,
        account_id: account.id,
        external_id: `demo-tx-${Date.now()}-${index}`,
        amount: Math.abs(t.amount),
        currency: "PLN",
        description: t.description,
        merchant_name: t.merchant,
        category_id: findCategory(t.merchant, t.description),
        transaction_date: date.toISOString().split("T")[0],
        booking_date: date.toISOString().split("T")[0],
        type: t.type as "income" | "expense",
      };
    });

    const { error: txError } = await supabase
      .from("transactions")
      .insert(transactionsToInsert);

    if (txError) {
      console.error("Transaction error:", txError);
      return NextResponse.json({ error: "Failed to create demo transactions" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Demo data created successfully",
      account: account.name,
      transactions: transactionsToInsert.length,
    });
  } catch (error) {
    console.error("Error creating demo data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
