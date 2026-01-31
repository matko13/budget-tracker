-- Budget App Database Schema - Part 2
-- Run this AFTER Part 1

-- Insert categorization rules for Polish merchants
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'biedronka', true FROM categories WHERE name = 'Zakupy spożywcze' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'lidl', true FROM categories WHERE name = 'Zakupy spożywcze' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'zabka', true FROM categories WHERE name = 'Zakupy spożywcze' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'carrefour', true FROM categories WHERE name = 'Zakupy spożywcze' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'auchan', true FROM categories WHERE name = 'Zakupy spożywcze' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'kaufland', true FROM categories WHERE name = 'Zakupy spożywcze' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'netto', true FROM categories WHERE name = 'Zakupy spożywcze' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'dino', true FROM categories WHERE name = 'Zakupy spożywcze' AND is_system = true;

INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'uber', true FROM categories WHERE name = 'Transport' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'bolt', true FROM categories WHERE name = 'Transport' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'orlen', true FROM categories WHERE name = 'Transport' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'shell', true FROM categories WHERE name = 'Transport' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'pkp', true FROM categories WHERE name = 'Transport' AND is_system = true;

INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'netflix', true FROM categories WHERE name = 'Rozrywka' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'spotify', true FROM categories WHERE name = 'Rozrywka' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'multikino', true FROM categories WHERE name = 'Rozrywka' AND is_system = true;

INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'allegro', true FROM categories WHERE name = 'Zakupy' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'amazon', true FROM categories WHERE name = 'Zakupy' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'zalando', true FROM categories WHERE name = 'Zakupy' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'ikea', true FROM categories WHERE name = 'Zakupy' AND is_system = true;

INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'mcdonald', true FROM categories WHERE name = 'Restauracje' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'kfc', true FROM categories WHERE name = 'Restauracje' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'starbucks', true FROM categories WHERE name = 'Restauracje' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'pyszne', true FROM categories WHERE name = 'Restauracje' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'glovo', true FROM categories WHERE name = 'Restauracje' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'wolt', true FROM categories WHERE name = 'Restauracje' AND is_system = true;

INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'orange', true FROM categories WHERE name = 'Rachunki' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'play', true FROM categories WHERE name = 'Rachunki' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 't-mobile', true FROM categories WHERE name = 'Rachunki' AND is_system = true;

INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'apteka', true FROM categories WHERE name = 'Zdrowie' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'rossmann', true FROM categories WHERE name = 'Zdrowie' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'medicover', true FROM categories WHERE name = 'Zdrowie' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'luxmed', true FROM categories WHERE name = 'Zdrowie' AND is_system = true;

INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'wynagrodzenie', true FROM categories WHERE name = 'Wynagrodzenie' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'wyplata', true FROM categories WHERE name = 'Wynagrodzenie' AND is_system = true;
INSERT INTO categorization_rules (category_id, keyword, is_system)
SELECT id, 'pensja', true FROM categories WHERE name = 'Wynagrodzenie' AND is_system = true;
