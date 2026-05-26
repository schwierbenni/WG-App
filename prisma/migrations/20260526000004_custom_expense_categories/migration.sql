-- CreateTable: WGExpenseCategory
CREATE TABLE "WGExpenseCategory" (
    "id" TEXT NOT NULL,
    "wgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "emoji" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WGExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WGExpenseCategory_wgId_slug_key" ON "WGExpenseCategory"("wgId", "slug");

-- AddForeignKey
ALTER TABLE "WGExpenseCategory" ADD CONSTRAINT "WGExpenseCategory_wgId_fkey" FOREIGN KEY ("wgId") REFERENCES "WGConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Change Expense.category from enum to TEXT (preserving existing values as strings)
ALTER TABLE "Expense" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;

-- Drop the old ExpenseCategory enum
DROP TYPE IF EXISTS "ExpenseCategory";

-- Seed default categories for all existing WGs
INSERT INTO "WGExpenseCategory" ("id", "wgId", "name", "slug", "color", "emoji", "isDefault", "sortOrder", "createdAt")
SELECT
    md5(wg."id" || '-' || cat.slug) as "id",
    wg."id" as "wgId",
    cat.name,
    cat.slug,
    cat.color,
    cat.emoji,
    true as "isDefault",
    cat.sort_order as "sortOrder",
    NOW() as "createdAt"
FROM "WGConfig" wg
CROSS JOIN (
    VALUES
        ('Lebensmittel', 'LEBENSMITTEL', '#16a34a', '🛒', 1),
        ('Haushalt', 'HAUSHALT', '#2563eb', '🏠', 2),
        ('Miete & NK', 'MIETE_NEBENKOSTEN', '#9333ea', '🏡', 3),
        ('Sonstiges', 'SONSTIGES', '#6b7280', '📝', 4)
) AS cat(name, slug, color, emoji, sort_order);
