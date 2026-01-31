-- Add payment_status to transactions for tracking recurring expense status
-- 'completed' = paid/done, 'planned' = scheduled but not yet due, 'skipped' = intentionally skipped

-- Create enum type for payment status
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('completed', 'planned', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add payment_status column to transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'completed';

-- Add is_recurring_generated flag to identify auto-generated transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS is_recurring_generated BOOLEAN DEFAULT false;

-- Make external_id nullable for generated transactions (they don't come from external sources)
ALTER TABLE transactions 
ALTER COLUMN external_id DROP NOT NULL;

-- Update unique constraint to allow multiple generated transactions
-- Drop the old constraint first
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_external_id_key;

-- Create new unique constraint that only applies to non-null external_ids
CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_id_external_id_unique 
ON transactions(user_id, external_id) 
WHERE external_id IS NOT NULL;

-- Index for finding recurring generated transactions
CREATE INDEX IF NOT EXISTS idx_transactions_recurring_generated 
ON transactions(is_recurring_generated) 
WHERE is_recurring_generated = true;

COMMENT ON COLUMN transactions.payment_status IS 'Status of the transaction: completed (paid), planned (scheduled), skipped';
COMMENT ON COLUMN transactions.is_recurring_generated IS 'True if this transaction was auto-generated from a recurring expense';
