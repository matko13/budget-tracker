-- Add recurring expenses table for tracking monthly recurring expenses

CREATE TABLE recurring_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'PLN',
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    match_keywords TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add recurring_expense_id to transactions for linking
ALTER TABLE transactions ADD COLUMN recurring_expense_id UUID REFERENCES recurring_expenses(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_recurring_expenses_user_id ON recurring_expenses(user_id);
CREATE INDEX idx_recurring_expenses_active ON recurring_expenses(is_active);
CREATE INDEX idx_transactions_recurring ON transactions(recurring_expense_id);

-- Enable RLS
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recurring_expenses
CREATE POLICY "Users can view own recurring expenses"
    ON recurring_expenses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring expenses"
    ON recurring_expenses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring expenses"
    ON recurring_expenses FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring expenses"
    ON recurring_expenses FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_recurring_expenses_updated_at
    BEFORE UPDATE ON recurring_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
