-- Add monthly overrides for recurring expenses
-- Allows changing amount or skipping specific months

CREATE TABLE recurring_expense_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recurring_expense_id UUID NOT NULL REFERENCES recurring_expenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    override_month DATE NOT NULL, -- First day of the month (e.g., 2026-01-01)
    override_amount DECIMAL(15, 2), -- NULL means use default amount
    is_skipped BOOLEAN DEFAULT false, -- If true, expense is skipped for this month
    notes TEXT, -- Optional note explaining the override
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(recurring_expense_id, override_month)
);

-- Indexes
CREATE INDEX idx_recurring_expense_overrides_expense ON recurring_expense_overrides(recurring_expense_id);
CREATE INDEX idx_recurring_expense_overrides_month ON recurring_expense_overrides(override_month);
CREATE INDEX idx_recurring_expense_overrides_user ON recurring_expense_overrides(user_id);

-- Enable RLS
ALTER TABLE recurring_expense_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own recurring expense overrides"
    ON recurring_expense_overrides FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring expense overrides"
    ON recurring_expense_overrides FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring expense overrides"
    ON recurring_expense_overrides FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring expense overrides"
    ON recurring_expense_overrides FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_recurring_expense_overrides_updated_at
    BEFORE UPDATE ON recurring_expense_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE recurring_expense_overrides IS 'Stores monthly overrides for recurring expenses - custom amounts or skips for specific months';
COMMENT ON COLUMN recurring_expense_overrides.override_month IS 'First day of the month this override applies to';
COMMENT ON COLUMN recurring_expense_overrides.override_amount IS 'Custom amount for this month, NULL means use default';
COMMENT ON COLUMN recurring_expense_overrides.is_skipped IS 'If true, this expense is skipped for this month';
