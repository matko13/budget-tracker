-- Migration: Add Child expense category
-- Run this in Supabase SQL Editor to add the child category

-- Insert new system category for child expenses
INSERT INTO categories (name, icon, color, type, is_system) VALUES
    ('Dzieci', '👶', '#fb7185', 'expense', true)
ON CONFLICT DO NOTHING;

-- Insert categorization rules for child-related expenses
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT c.id, k.keyword, true
FROM categories c
JOIN (
    VALUES 
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
WHERE c.is_system = true
ON CONFLICT DO NOTHING;
