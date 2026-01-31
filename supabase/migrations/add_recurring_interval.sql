-- Add interval_months column to recurring_expenses for non-monthly recurrence
-- Values: 1 (monthly), 2 (bi-monthly), 3 (quarterly), 6 (semi-annually), 12 (annually)

ALTER TABLE recurring_expenses 
ADD COLUMN interval_months INTEGER NOT NULL DEFAULT 1 
CHECK (interval_months IN (1, 2, 3, 6, 12));

-- Add last_occurrence_date to track when this expense was last matched
-- This helps determine when the next occurrence should be
ALTER TABLE recurring_expenses 
ADD COLUMN last_occurrence_date DATE;

COMMENT ON COLUMN recurring_expenses.interval_months IS 'Number of months between occurrences: 1=monthly, 2=bi-monthly, 3=quarterly, 6=semi-annually, 12=annually';
