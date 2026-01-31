-- Migration: Add new budget categories
-- Run this in Supabase SQL Editor to add the new categories

-- Insert new system categories
INSERT INTO categories (name, icon, color, type, is_system) VALUES
    ('Business', '💼', '#0ea5e9', 'expense', true),
    ('Housing', '🏠', '#84cc16', 'expense', true),
    ('Insurance', '🛡️', '#f59e0b', 'expense', true),
    ('Car & Leasing', '🚙', '#64748b', 'expense', true),
    ('Installments', '📅', '#78716c', 'expense', true),
    ('Personal Care', '💇', '#f472b6', 'expense', true),
    ('Fitness', '🏋️', '#10b981', 'expense', true),
    ('Retirement', '🏦', '#6366f1', 'expense', true)
ON CONFLICT DO NOTHING;

-- Insert categorization rules for new categories
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT c.id, k.keyword, true
FROM categories c
CROSS JOIN (
    VALUES 
        -- Business
        ('Business', 'księgowość'),
        ('Business', 'ksiegowosc'),
        ('Business', 'zus'),
        ('Business', 'pit'),
        ('Business', 'vat'),
        ('Business', 'podatek'),
        ('Business', 'urząd skarbowy'),
        ('Business', 'urzad skarbowy'),
        -- Housing
        ('Housing', 'kredyt'),
        ('Housing', 'mortgage'),
        ('Housing', 'czynsz'),
        ('Housing', 'hipoteka'),
        ('Housing', 'hipoteczny'),
        -- Insurance
        ('Insurance', 'ubezpieczenie'),
        ('Insurance', 'polisa'),
        ('Insurance', 'pzu'),
        ('Insurance', 'warta'),
        ('Insurance', 'allianz'),
        ('Insurance', 'ergo hestia'),
        ('Insurance', 'generali'),
        -- Car & Leasing
        ('Car & Leasing', 'leasing'),
        ('Car & Leasing', 'volvo'),
        ('Car & Leasing', 'mercedes'),
        ('Car & Leasing', 'wykup'),
        ('Car & Leasing', 'rata samochod'),
        -- Installments
        ('Installments', 'raty'),
        ('Installments', 'rata'),
        ('Installments', 'splata'),
        ('Installments', 'ratalna'),
        -- Personal Care
        ('Personal Care', 'fryzjer'),
        ('Personal Care', 'barber'),
        ('Personal Care', 'salon'),
        ('Personal Care', 'kosmetyczka'),
        ('Personal Care', 'manicure'),
        -- Fitness
        ('Fitness', 'silka'),
        ('Fitness', 'siłownia'),
        ('Fitness', 'silownia'),
        ('Fitness', 'gym'),
        ('Fitness', 'fitness'),
        ('Fitness', 'multisport'),
        ('Fitness', 'benefit'),
        -- Retirement
        ('Retirement', 'emerytura'),
        ('Retirement', 'ike'),
        ('Retirement', 'ikze'),
        ('Retirement', 'ppk'),
        ('Retirement', 'emerytalne')
) AS k(category_name, keyword) ON c.name = k.category_name
WHERE c.is_system = true
ON CONFLICT DO NOTHING;
