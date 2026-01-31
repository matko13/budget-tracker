-- Add is_excluded column to transactions table
-- This allows marking internal transfers or other transactions to exclude from income/expense totals
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_excluded BOOLEAN DEFAULT false;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_transactions_is_excluded ON transactions(is_excluded);
