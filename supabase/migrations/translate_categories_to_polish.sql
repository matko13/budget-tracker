-- Migration: Translate system categories to Polish
-- Run this to update existing categories to Polish names

-- Update expense categories
UPDATE categories SET name = 'Zakupy spożywcze' WHERE name = 'Groceries' AND is_system = true;
UPDATE categories SET name = 'Rozrywka' WHERE name = 'Entertainment' AND is_system = true;
UPDATE categories SET name = 'Zakupy' WHERE name = 'Shopping' AND is_system = true;
UPDATE categories SET name = 'Restauracje' WHERE name = 'Restaurants' AND is_system = true;
UPDATE categories SET name = 'Rachunki' WHERE name = 'Bills & Utilities' AND is_system = true;
UPDATE categories SET name = 'Zdrowie' WHERE name = 'Health' AND is_system = true;
UPDATE categories SET name = 'Edukacja' WHERE name = 'Education' AND is_system = true;
UPDATE categories SET name = 'Podróże' WHERE name = 'Travel' AND is_system = true;
UPDATE categories SET name = 'Subskrypcje' WHERE name = 'Subscriptions' AND is_system = true;
UPDATE categories SET name = 'Biznes' WHERE name = 'Business' AND is_system = true;
UPDATE categories SET name = 'Mieszkanie' WHERE name = 'Housing' AND is_system = true;
UPDATE categories SET name = 'Ubezpieczenia' WHERE name = 'Insurance' AND is_system = true;
UPDATE categories SET name = 'Samochód i leasing' WHERE name = 'Car & Leasing' AND is_system = true;
UPDATE categories SET name = 'Raty' WHERE name = 'Installments' AND is_system = true;
UPDATE categories SET name = 'Pielęgnacja' WHERE name = 'Personal Care' AND is_system = true;
UPDATE categories SET name = 'Emerytura' WHERE name = 'Retirement' AND is_system = true;

-- Update income categories
UPDATE categories SET name = 'Wynagrodzenie' WHERE name = 'Salary' AND is_system = true;
UPDATE categories SET name = 'Inwestycje' WHERE name = 'Investments' AND is_system = true;

-- Update both type categories
UPDATE categories SET name = 'Prezenty' WHERE name = 'Gifts' AND is_system = true;
UPDATE categories SET name = 'Przelew' WHERE name = 'Transfer' AND is_system = true;
UPDATE categories SET name = 'Inne' WHERE name = 'Other' AND is_system = true;

-- Note: Transport, Fitness, and Freelance stay the same as they're commonly used in Polish
