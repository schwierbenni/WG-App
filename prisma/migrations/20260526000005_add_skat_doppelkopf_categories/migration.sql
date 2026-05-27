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
        ('Skat', 'SKAT', '#d97706', '🃏', 5),
        ('Doppelkopf', 'DOPPELKOPF', '#ea580c', '🀄', 6)
) AS cat(name, slug, color, emoji, sort_order)
ON CONFLICT ("wgId", "slug") DO NOTHING;
