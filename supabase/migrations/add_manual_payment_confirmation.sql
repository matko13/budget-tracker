-- Add manual payment confirmation to recurring expense overrides
-- This allows users to mark an expense as paid even without a linked bank transaction

-- Add is_manually_confirmed column
ALTER TABLE recurring_expense_overrides 
ADD COLUMN IF NOT EXISTS is_manually_confirmed BOOLEAN DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN recurring_expense_overrides.is_manually_confirmed IS 'If true, user has manually confirmed this expense as paid for this month (without a linked bank transaction)';
