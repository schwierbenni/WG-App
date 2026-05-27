-- Convert ShoppingItem.category from enum to TEXT with explicit default
ALTER TABLE "ShoppingItem"
  ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT,
  ALTER COLUMN "category" SET DEFAULT 'LEBENSMITTEL';

DROP TYPE IF EXISTS "ShoppingCategory" CASCADE;
