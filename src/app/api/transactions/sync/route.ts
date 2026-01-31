import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";
import { gocardless, GoCardlessTransaction } from "@/lib/gocardless/client";

// Helper to determine transaction type
function getTransactionType(amount: number): "income" | "expense" | "transfer" {
  return amount >= 0 ? "income" : "expense";
}

// Helper to get description from transaction
function getDescription(transaction: GoCardlessTransaction): string {
  if (transaction.remittanceInformationUnstructured) {
    return transaction.remittanceInformationUnstructured;
  }
  if (transaction.remittanceInformationUnstructuredArray?.length) {
    return transaction.remittanceInformationUnstructuredArray.join(" ");
  }
  if (transaction.creditorName) {
    return `Payment to ${transaction.creditorName}`;
  }
  if (transaction.debtorName) {
    return `Payment from ${transaction.debtorName}`;
  }
  return "Transaction";
}

// Helper to get merchant name
function getMerchantName(transaction: GoCardlessTransaction): string | null {
  return transaction.creditorName || transaction.debtorName || null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { accountId } = body;

    // If specific account, sync just that one. Otherwise sync all.
    let accounts;
    if (accountId) {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", accountId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
      accounts = [data];
    } else {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
      }
      accounts = data || [];
    }

    let totalSynced = 0;
    let totalNew = 0;

    for (const account of accounts) {
      try {
        // Calculate date range - last 90 days
        const dateTo = new Date().toISOString().split("T")[0];
        const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

        // Fetch transactions from GoCardless
        const transactionsResponse = await gocardless.getAccountTransactions(
          account.external_id,
          dateFrom,
          dateTo
        );

        const bookedTransactions = transactionsResponse.transactions.booked || [];

        // Update account balance
        const balances = await gocardless.getAccountBalances(account.external_id);
        const currentBalance = balances.find(
          (b) => b.balanceType === "expected" || b.balanceType === "interimAvailable"
        ) || balances[0];

        if (currentBalance) {
          await supabase
            .from("accounts")
            .update({
              balance: parseFloat(currentBalance.balanceAmount.amount),
              balance_updated_at: new Date().toISOString(),
            })
            .eq("id", account.id);
        }

        // Process and save transactions
        for (const transaction of bookedTransactions) {
          const amount = parseFloat(transaction.transactionAmount.amount);
          const description = getDescription(transaction);
          const merchantName = getMerchantName(transaction);

          // Check if transaction already exists
          const { data: existing } = await supabase
            .from("transactions")
            .select("id")
            .eq("external_id", transaction.transactionId)
            .eq("user_id", user.id)
            .single();

          if (existing) {
            totalSynced++;
            continue;
          }

          // Auto-categorize based on description/merchant
          let categoryId = null;
          let recurringExpenseId = null;
          const searchText = ((merchantName || "") + " " + description).toLowerCase();
          const transactionDate = transaction.valueDate || transaction.bookingDate || dateTo;
          
          if (searchText.trim()) {
            // Check for recurring expense match first
            const { data: recurringExpenses } = await supabase
              .from("recurring_expenses")
              .select("id, amount, category_id, match_keywords, interval_months, last_occurrence_date, start_date")
              .eq("user_id", user.id)
              .eq("is_active", true);

            if (recurringExpenses) {
              const txDate = new Date(transactionDate);
              const txMonth = txDate.getFullYear() * 12 + txDate.getMonth();

              for (const recurring of recurringExpenses) {
                // Check if any keyword matches
                const keywords = recurring.match_keywords || [];
                const keywordMatch = keywords.some((keyword: string) =>
                  searchText.includes(keyword.toLowerCase())
                );

                if (keywordMatch) {
                  // Check if this expense is due based on interval
                  const intervalMonths = recurring.interval_months || 1;
                  let isDue = true;

                  if (recurring.last_occurrence_date) {
                    const lastDate = new Date(recurring.last_occurrence_date);
                    const lastMonth = lastDate.getFullYear() * 12 + lastDate.getMonth();
                    const monthsSinceLast = txMonth - lastMonth;
                    isDue = monthsSinceLast >= intervalMonths;
                  } else {
                    const startDate = new Date(recurring.start_date);
                    const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
                    const monthsSinceStart = txMonth - startMonth;
                    isDue = monthsSinceStart >= 0 && monthsSinceStart % intervalMonths === 0;
                  }

                  if (isDue) {
                    // Check if already matched this month
                    const txMonthStr = transactionDate.substring(0, 7);
                    const { data: alreadyMatched } = await supabase
                      .from("transactions")
                      .select("id")
                      .eq("recurring_expense_id", recurring.id)
                      .gte("transaction_date", `${txMonthStr}-01`)
                      .lte("transaction_date", `${txMonthStr}-31`)
                      .limit(1);

                    if (!alreadyMatched || alreadyMatched.length === 0) {
                      recurringExpenseId = recurring.id;
                      // Use the recurring expense's category if available
                      if (recurring.category_id) {
                        categoryId = recurring.category_id;
                      }
                      break;
                    }
                  }
                }
              }
            }

            // If no recurring match, use categorization rules
            if (!categoryId) {
              const { data: rules } = await supabase
                .from("categorization_rules")
                .select("category_id, keyword")
                .or(`user_id.eq.${user.id},is_system.eq.true`);

              if (rules) {
                for (const rule of rules) {
                  if (searchText.includes(rule.keyword.toLowerCase())) {
                    categoryId = rule.category_id;
                    break;
                  }
                }
              }
            }
          }

          // Insert new transaction
          const { error: insertError } = await supabase.from("transactions").insert({
            user_id: user.id,
            account_id: account.id,
            external_id: transaction.transactionId,
            amount: Math.abs(amount),
            currency: transaction.transactionAmount.currency,
            description,
            merchant_name: merchantName,
            category_id: categoryId,
            recurring_expense_id: recurringExpenseId,
            transaction_date: transactionDate,
            booking_date: transaction.bookingDate,
            type: getTransactionType(amount),
          });

          if (!insertError) {
            totalNew++;
            
            // Update last_occurrence_date for recurring expense if matched
            if (recurringExpenseId) {
              await supabase
                .from("recurring_expenses")
                .update({ last_occurrence_date: transactionDate })
                .eq("id", recurringExpenseId);
            }
          }
          totalSynced++;
        }
      } catch (accountError) {
        console.error(`Error syncing account ${account.id}:`, accountError);
      }
    }

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      new: totalNew,
      accounts: accounts.length,
    });
  } catch (error) {
    console.error("Error syncing transactions:", error);
    return NextResponse.json(
      { error: "Failed to sync transactions" },
      { status: 500 }
    );
  }
}
