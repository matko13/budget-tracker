-- Fix duplicate recurring generated transactions
-- This migration:
-- 1. Adds a generated_month column to track which month a recurring transaction belongs to
-- 2. Removes duplicate auto-generated recurring transactions (keeps oldest per expense per month)
-- 3. Adds a unique partial index to prevent future duplicates

-- Step 1: Add generated_month column (stores YYYY-MM for recurring generated transactions)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS generated_month TEXT;

-- Step 2: Populate generated_month for existing recurring generated transactions
UPDATE transactions 
SET generated_month = TO_CHAR(transaction_date, 'YYYY-MM')
WHERE is_recurring_generated = true 
  AND recurring_expense_id IS NOT NULL
  AND generated_month IS NULL;

-- Step 3: Delete duplicate generated transactions (keep oldest)
-- For each recurring_expense_id + month combination, keep only the first-created transaction
DELETE FROM transactions t1
USING (
    SELECT 
        recurring_expense_id,
        generated_month,
        MIN(created_at) AS min_created_at
    FROM transactions
    WHERE is_recurring_generated = true
      AND recurring_expense_id IS NOT NULL
      AND generated_month IS NOT NULL
    GROUP BY recurring_expense_id, generated_month
    HAVING COUNT(*) > 1
) duplicates
WHERE t1.recurring_expense_id = duplicates.recurring_expense_id
  AND t1.generated_month = duplicates.generated_month
  AND t1.is_recurring_generated = true
  AND t1.created_at > duplicates.min_created_at;

-- Step 4: Add a unique partial index to prevent future duplicates
-- This ensures only ONE auto-generated transaction exists per recurring expense per month
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_recurring_generated_per_month 
ON transactions (recurring_expense_id, generated_month)
WHERE is_recurring_generated = true AND recurring_expense_id IS NOT NULL;
