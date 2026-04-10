-- Budget App Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE category_type AS ENUM ('income', 'expense', 'both');
CREATE TYPE budget_period AS ENUM ('monthly', 'weekly', 'yearly');

-- Accounts table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    external_id TEXT,
    iban TEXT,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'PLN',
    balance DECIMAL(15, 2) DEFAULT 0,
    balance_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    type category_type DEFAULT 'expense',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'PLN',
    description TEXT NOT NULL,
    merchant_name TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    transaction_date DATE NOT NULL,
    booking_date DATE,
    type transaction_type NOT NULL,
    is_excluded BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, external_id)
);

-- Categorization Rules table
CREATE TABLE categorization_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budgets table
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    period budget_period DEFAULT 'monthly',
    budget_month DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE),
    start_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category_id, budget_month)
);

-- Indexes for better query performance
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_is_excluded ON transactions(is_excluded);
CREATE INDEX idx_categorization_rules_category_id ON categorization_rules(category_id);
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_month ON budgets(budget_month);

-- Row Level Security (RLS) Policies
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Accounts policies
CREATE POLICY "Users can view own accounts"
    ON accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
    ON accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
    ON accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
    ON accounts FOR DELETE
    USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions"
    ON transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
    ON transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
    ON transactions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
    ON transactions FOR DELETE
    USING (auth.uid() = user_id);

-- Categories policies (users can see system categories + their own)
CREATE POLICY "Users can view categories"
    ON categories FOR SELECT
    USING (is_system = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
    ON categories FOR INSERT
    WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own categories"
    ON categories FOR UPDATE
    USING (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own categories"
    ON categories FOR DELETE
    USING (auth.uid() = user_id AND is_system = false);

-- Categorization Rules policies
CREATE POLICY "Users can view categorization rules"
    ON categorization_rules FOR SELECT
    USING (is_system = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert own categorization rules"
    ON categorization_rules FOR INSERT
    WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own categorization rules"
    ON categorization_rules FOR UPDATE
    USING (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own categorization rules"
    ON categorization_rules FOR DELETE
    USING (auth.uid() = user_id AND is_system = false);

-- Budgets policies
CREATE POLICY "Users can view own budgets"
    ON budgets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets"
    ON budgets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets"
    ON budgets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets"
    ON budgets FOR DELETE
    USING (auth.uid() = user_id);

-- Insert default system categories
INSERT INTO categories (name, icon, color, type, is_system) VALUES
    ('Zakupy spożywcze', '🛒', '#22c55e', 'expense', true),
    ('Transport', '🚗', '#3b82f6', 'expense', true),
    ('Rozrywka', '🎬', '#a855f7', 'expense', true),
    ('Zakupy', '🛍️', '#f97316', 'expense', true),
    ('Restauracje', '🍽️', '#ef4444', 'expense', true),
    ('Rachunki', '📄', '#6366f1', 'expense', true),
    ('Zdrowie', '💊', '#14b8a6', 'expense', true),
    ('Edukacja', '📚', '#8b5cf6', 'expense', true),
    ('Podróże', '✈️', '#06b6d4', 'expense', true),
    ('Subskrypcje', '📱', '#ec4899', 'expense', true),
    ('Biznes', '💼', '#0ea5e9', 'expense', true),
    ('Mieszkanie', '🏠', '#84cc16', 'expense', true),
    ('Ubezpieczenia', '🛡️', '#f59e0b', 'expense', true),
    ('Samochód i leasing', '🚙', '#64748b', 'expense', true),
    ('Raty', '📅', '#78716c', 'expense', true),
    ('Pielęgnacja', '💇', '#f472b6', 'expense', true),
    ('Fitness', '🏋️', '#10b981', 'expense', true),
    ('Emerytura', '🏦', '#6366f1', 'expense', true),
    ('Dzieci', '👶', '#fb7185', 'expense', true),
    ('Wynagrodzenie', '💰', '#22c55e', 'income', true),
    ('Freelance', '💻', '#3b82f6', 'income', true),
    ('Inwestycje', '📈', '#f59e0b', 'income', true),
    ('Prezenty', '🎁', '#ec4899', 'both', true),
    ('Przelew', '↔️', '#64748b', 'both', true),
    ('Inne', '📌', '#94a3b8', 'both', true);

-- Insert default categorization rules for Polish merchants
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT c.id, k.keyword, true
FROM categories c
CROSS JOIN (
    VALUES 
        -- Zakupy spożywcze
        ('Zakupy spożywcze', 'biedronka'),
        ('Zakupy spożywcze', 'lidl'),
        ('Zakupy spożywcze', 'żabka'),
        ('Zakupy spożywcze', 'zabka'),
        ('Zakupy spożywcze', 'carrefour'),
        ('Zakupy spożywcze', 'auchan'),
        ('Zakupy spożywcze', 'kaufland'),
        ('Zakupy spożywcze', 'netto'),
        ('Zakupy spożywcze', 'dino'),
        ('Zakupy spożywcze', 'stokrotka'),
        ('Zakupy spożywcze', 'lewiatan'),
        ('Zakupy spożywcze', 'freshmarket'),
        -- Transport
        ('Transport', 'uber'),
        ('Transport', 'bolt'),
        ('Transport', 'freenow'),
        ('Transport', 'orlen'),
        ('Transport', 'bp '),
        ('Transport', 'shell'),
        ('Transport', 'circle k'),
        ('Transport', 'pkp'),
        ('Transport', 'mpk'),
        ('Transport', 'ztm'),
        ('Transport', 'jakdojade'),
        -- Rozrywka
        ('Rozrywka', 'netflix'),
        ('Rozrywka', 'spotify'),
        ('Rozrywka', 'cinema'),
        ('Rozrywka', 'multikino'),
        ('Rozrywka', 'helios'),
        -- Zakupy
        ('Zakupy', 'allegro'),
        ('Zakupy', 'amazon'),
        ('Zakupy', 'zalando'),
        ('Zakupy', 'reserved'),
        ('Zakupy', 'h&m'),
        ('Zakupy', 'zara'),
        ('Zakupy', 'decathlon'),
        ('Zakupy', 'media markt'),
        ('Zakupy', 'rtv euro agd'),
        ('Zakupy', 'ikea'),
        -- Restauracje
        ('Restauracje', 'mcdonald'),
        ('Restauracje', 'kfc'),
        ('Restauracje', 'burger king'),
        ('Restauracje', 'pizza hut'),
        ('Restauracje', 'dominos'),
        ('Restauracje', 'starbucks'),
        ('Restauracje', 'costa coffee'),
        ('Restauracje', 'pyszne'),
        ('Restauracje', 'uber eats'),
        ('Restauracje', 'glovo'),
        ('Restauracje', 'wolt'),
        -- Rachunki
        ('Rachunki', 'orange'),
        ('Rachunki', 'play'),
        ('Rachunki', 't-mobile'),
        ('Rachunki', 'plus'),
        ('Rachunki', 'pge'),
        ('Rachunki', 'enea'),
        ('Rachunki', 'tauron'),
        ('Rachunki', 'upc'),
        ('Rachunki', 'vectra'),
        -- Zdrowie
        ('Zdrowie', 'apteka'),
        ('Zdrowie', 'pharmacy'),
        ('Zdrowie', 'rossmann'),
        ('Zdrowie', 'hebe'),
        ('Zdrowie', 'medicover'),
        ('Zdrowie', 'luxmed'),
        -- Subskrypcje
        ('Subskrypcje', 'youtube premium'),
        ('Subskrypcje', 'hbo max'),
        ('Subskrypcje', 'disney'),
        ('Subskrypcje', 'apple'),
        ('Subskrypcje', 'google'),
        ('Subskrypcje', 'microsoft'),
        -- Wynagrodzenie
        ('Wynagrodzenie', 'wynagrodzenie'),
        ('Wynagrodzenie', 'wyplata'),
        ('Wynagrodzenie', 'salary'),
        ('Wynagrodzenie', 'pensja'),
        -- Biznes
        ('Biznes', 'księgowość'),
        ('Biznes', 'ksiegowosc'),
        ('Biznes', 'zus'),
        ('Biznes', 'pit'),
        ('Biznes', 'vat'),
        ('Biznes', 'podatek'),
        ('Biznes', 'urząd skarbowy'),
        ('Biznes', 'urzad skarbowy'),
        -- Mieszkanie
        ('Mieszkanie', 'kredyt'),
        ('Mieszkanie', 'mortgage'),
        ('Mieszkanie', 'czynsz'),
        ('Mieszkanie', 'hipoteka'),
        ('Mieszkanie', 'hipoteczny'),
        -- Ubezpieczenia
        ('Ubezpieczenia', 'ubezpieczenie'),
        ('Ubezpieczenia', 'polisa'),
        ('Ubezpieczenia', 'pzu'),
        ('Ubezpieczenia', 'warta'),
        ('Ubezpieczenia', 'allianz'),
        ('Ubezpieczenia', 'ergo hestia'),
        ('Ubezpieczenia', 'generali'),
        -- Samochód i leasing
        ('Samochód i leasing', 'leasing'),
        ('Samochód i leasing', 'volvo'),
        ('Samochód i leasing', 'mercedes'),
        ('Samochód i leasing', 'wykup'),
        ('Samochód i leasing', 'rata samochod'),
        -- Raty
        ('Raty', 'raty'),
        ('Raty', 'rata'),
        ('Raty', 'splata'),
        ('Raty', 'ratalna'),
        -- Pielęgnacja
        ('Pielęgnacja', 'fryzjer'),
        ('Pielęgnacja', 'barber'),
        ('Pielęgnacja', 'salon'),
        ('Pielęgnacja', 'kosmetyczka'),
        ('Pielęgnacja', 'manicure'),
        -- Fitness
        ('Fitness', 'silka'),
        ('Fitness', 'siłownia'),
        ('Fitness', 'silownia'),
        ('Fitness', 'gym'),
        ('Fitness', 'fitness'),
        ('Fitness', 'multisport'),
        ('Fitness', 'benefit'),
        -- Emerytura
        ('Emerytura', 'emerytura'),
        ('Emerytura', 'ike'),
        ('Emerytura', 'ikze'),
        ('Emerytura', 'ppk'),
        ('Emerytura', 'emerytalne'),
        -- Dzieci
        ('Dzieci', 'przedszkole'),
        ('Dzieci', 'żłobek'),
        ('Dzieci', 'zlobek'),
        ('Dzieci', 'szkoła'),
        ('Dzieci', 'szkola'),
        ('Dzieci', 'pampersy'),
        ('Dzieci', 'pieluchy'),
        ('Dzieci', 'zabawki'),
        ('Dzieci', 'dziecko'),
        ('Dzieci', 'dziecięce'),
        ('Dzieci', 'dzieciece'),
        ('Dzieci', 'smyk'),
        ('Dzieci', 'toys'),
        ('Dzieci', 'pepco'),
        ('Dzieci', 'kinder'),
        ('Dzieci', 'mleko dla dzieci'),
        ('Dzieci', 'odzież dziecięca'),
        ('Dzieci', 'odziez dziecieca'),
        ('Dzieci', 'kid'),
        ('Dzieci', 'baby')
) AS k(category_name, keyword) ON c.name = k.category_name
WHERE c.is_system = true;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
