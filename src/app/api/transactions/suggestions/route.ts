import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";

interface TransactionSuggestion {
  id: string;
  description: string;
  merchantName: string | null;
  amount: number;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  type: "income" | "expense";
  source: "transaction" | "recurring";
  frequency: number; // How many times this combination appeared
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
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type"); // "income" or "expense"
    const limit = parseInt(searchParams.get("limit") || "10");

    // Need at least 2 characters for suggestions
    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions: TransactionSuggestion[] = [];
    const seenKeys = new Set<string>(); // To avoid duplicates

    // Helper to create a unique key for deduplication
    const createKey = (description: string, merchantName: string | null, amount: number) => {
      const normalizedDesc = description.toLowerCase().trim();
      const normalizedMerchant = (merchantName || "").toLowerCase().trim();
      return `${normalizedDesc}|${normalizedMerchant}|${Math.round(amount * 100)}`;
    };

    // 1. First, get suggestions from recurring expenses (highest priority)
    const recurringQuery = supabase
      .from("recurring_expenses")
      .select("id, name, amount, category_id, categories(name, icon)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .ilike("name", `%${query}%`)
      .limit(5);

    const { data: recurringExpenses } = await recurringQuery;

    if (recurringExpenses) {
      for (const expense of recurringExpenses) {
        const key = createKey(expense.name, null, expense.amount);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          // Categories can be a single object or null depending on the relation
          const categoryData = expense.categories;
          const category = categoryData && typeof categoryData === 'object' && !Array.isArray(categoryData)
            ? categoryData as { name: string; icon: string | null }
            : null;
          suggestions.push({
            id: `recurring-${expense.id}`,
            description: expense.name,
            merchantName: null,
            amount: parseFloat(expense.amount),
            categoryId: expense.category_id,
            categoryName: category?.name || null,
            categoryIcon: category?.icon || null,
            type: "expense",
            source: "recurring",
            frequency: 100, // High priority for recurring
          });
        }
      }
    }

    // 2. Get suggestions from past transactions
    // We'll aggregate by description and merchant to find common patterns
    let transactionQuery = supabase
      .from("transactions")
      .select("id, description, merchant_name, amount, category_id, type, categories(name, icon)")
      .eq("user_id", user.id)
      .or(`description.ilike.%${query}%,merchant_name.ilike.%${query}%`)
      .order("transaction_date", { ascending: false })
      .limit(100); // Get more to aggregate

    if (type === "income" || type === "expense") {
      transactionQuery = transactionQuery.eq("type", type);
    }

    const { data: transactions } = await transactionQuery;

    if (transactions) {
      // Aggregate transactions by description+merchant combination
      const aggregated = new Map<
        string,
        {
          description: string;
          merchantName: string | null;
          amounts: number[];
          categoryId: string | null;
          categoryName: string | null;
          categoryIcon: string | null;
          type: "income" | "expense";
          count: number;
          lastId: string;
        }
      >();

      for (const tx of transactions) {
        // Skip transfers
        if (tx.type === "transfer") continue;

        const key = `${tx.description.toLowerCase().trim()}|${(tx.merchant_name || "").toLowerCase().trim()}`;

        // Categories can be a single object or null depending on the relation
        const categoryData = tx.categories;
        const category = categoryData && typeof categoryData === 'object' && !Array.isArray(categoryData)
          ? categoryData as { name: string; icon: string | null }
          : null;

        if (aggregated.has(key)) {
          const existing = aggregated.get(key)!;
          existing.amounts.push(parseFloat(tx.amount));
          existing.count++;
          // Update category if this transaction has one and existing doesn't
          if (tx.category_id && !existing.categoryId) {
            existing.categoryId = tx.category_id;
            existing.categoryName = category?.name || null;
            existing.categoryIcon = category?.icon || null;
          }
        } else {
          aggregated.set(key, {
            description: tx.description,
            merchantName: tx.merchant_name,
            amounts: [parseFloat(tx.amount)],
            categoryId: tx.category_id,
            categoryName: category?.name || null,
            categoryIcon: category?.icon || null,
            type: tx.type as "income" | "expense",
            count: 1,
            lastId: tx.id,
          });
        }
      }

      // Convert aggregated to suggestions
      for (const [, data] of aggregated) {
        // Calculate the most common amount (mode) or average
        const avgAmount =
          data.amounts.reduce((sum, a) => sum + a, 0) / data.amounts.length;
        
        // Use the most recent amount if amounts vary significantly, otherwise use average
        const amountVariance = data.amounts.length > 1 
          ? Math.max(...data.amounts) - Math.min(...data.amounts) 
          : 0;
        const suggestedAmount = amountVariance > avgAmount * 0.5 
          ? data.amounts[0] // Use most recent
          : Math.round(avgAmount * 100) / 100; // Use average

        const key = createKey(data.description, data.merchantName, suggestedAmount);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          suggestions.push({
            id: `tx-${data.lastId}`,
            description: data.description,
            merchantName: data.merchantName,
            amount: suggestedAmount,
            categoryId: data.categoryId,
            categoryName: data.categoryName,
            categoryIcon: data.categoryIcon,
            type: data.type,
            source: "transaction",
            frequency: data.count,
          });
        }
      }
    }

    // Sort suggestions by frequency (more common = higher priority)
    // Recurring expenses get a boost
    suggestions.sort((a, b) => {
      // Recurring expenses first
      if (a.source === "recurring" && b.source !== "recurring") return -1;
      if (b.source === "recurring" && a.source !== "recurring") return 1;
      // Then by frequency
      return b.frequency - a.frequency;
    });

    // Filter by type if specified
    let filteredSuggestions = suggestions;
    if (type === "income" || type === "expense") {
      filteredSuggestions = suggestions.filter((s) => s.type === type);
    }

    return NextResponse.json({
      suggestions: filteredSuggestions.slice(0, limit),
    });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
