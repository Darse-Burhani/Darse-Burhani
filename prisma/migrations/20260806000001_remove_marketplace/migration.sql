-- Drop the marketplace (token shop) tables. FK from marketplace_purchases to
-- marketplace_items is dropped with the table, so drop purchases first.

DROP TABLE IF EXISTS "marketplace_purchases";
DROP TABLE IF EXISTS "marketplace_items";
