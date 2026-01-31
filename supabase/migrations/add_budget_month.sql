-- Migration: Add budget_month column for month-specific budgets
-- This allows users to set different budget amounts for each category per month

-- Add month column (YYYY-MM-01 format for the first of each month)
ALTER TABLE budgets ADD COLUMN budget_month DATE;

-- Backfill existing budgets with current month
UPDATE budgets SET budget_month = DATE_TRUNC('month', CURRENT_DATE);

-- Make budget_month NOT NULL
ALTER TABLE budgets ALTER COLUMN budget_month SET NOT NULL;

-- Drop old unique constraint and add new one
-- The old constraint was: UNIQUE(user_id, category_id, period)
-- The new constraint is: UNIQUE(user_id, category_id, budget_month)
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_user_id_category_id_period_key;
ALTER TABLE budgets ADD CONSTRAINT budgets_user_id_category_id_month_key 
    UNIQUE(user_id, category_id, budget_month);

-- Add index for efficient month queries
CREATE INDEX idx_budgets_month ON budgets(budget_month);
