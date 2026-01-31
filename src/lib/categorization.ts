import { createUntypedClient } from "@/lib/supabase/server-untyped";

export interface CategorizationResult {
  categoryId: string | null;
  categoryName: string | null;
  confidence: "high" | "medium" | "low" | "none";
}

interface Rule {
  id: string;
  keyword: string;
  is_system: boolean;
  category: { id: string; name: string }[] | null;
}

/**
 * Rule-based categorization service
 * Matches transaction descriptions against keywords to assign categories
 */
export async function categorizeTransaction(
  userId: string,
  description: string,
  merchantName: string | null
): Promise<CategorizationResult> {
  const supabase = await createUntypedClient();

  // Combine description and merchant for better matching
  const searchText = `${merchantName || ""} ${description}`.toLowerCase();

  // Get all applicable rules (system + user's custom rules)
  const { data: rules, error } = await supabase
    .from("categorization_rules")
    .select(`
      id,
      keyword,
      is_system,
      category:categories(id, name)
    `)
    .or(`user_id.eq.${userId},is_system.eq.true`)
    .order("is_system", { ascending: true }); // User rules take priority

  if (error || !rules) {
    return { categoryId: null, categoryName: null, confidence: "none" };
  }

  // Find matching rules
  for (const rule of rules as Rule[]) {
    const keyword = rule.keyword.toLowerCase();
    
    // Check for exact match or substring match
    if (searchText.includes(keyword)) {
      const category = rule.category?.[0];
      if (category) {
        return {
          categoryId: category.id,
          categoryName: category.name,
          confidence: rule.is_system ? "medium" : "high",
        };
      }
    }
  }

  return { categoryId: null, categoryName: null, confidence: "none" };
}

/**
 * Batch categorize multiple transactions
 */
export async function categorizeTransactions(
  userId: string,
  transactions: Array<{ id: string; description: string; merchantName: string | null }>
): Promise<Map<string, CategorizationResult>> {
  const results = new Map<string, CategorizationResult>();

  for (const transaction of transactions) {
    const result = await categorizeTransaction(
      userId,
      transaction.description,
      transaction.merchantName
    );
    results.set(transaction.id, result);
  }

  return results;
}

/**
 * Re-categorize all uncategorized transactions for a user
 */
export async function recategorizeUncategorized(userId: string): Promise<number> {
  const supabase = await createUntypedClient();

  // Get all uncategorized transactions
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("id, description, merchant_name")
    .eq("user_id", userId)
    .is("category_id", null);

  if (error || !transactions) {
    return 0;
  }

  let updated = 0;

  for (const transaction of transactions as Array<{ id: string; description: string; merchant_name: string | null }>) {
    const result = await categorizeTransaction(
      userId,
      transaction.description,
      transaction.merchant_name
    );

    if (result.categoryId) {
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ category_id: result.categoryId })
        .eq("id", transaction.id);

      if (!updateError) {
        updated++;
      }
    }
  }

  return updated;
}
