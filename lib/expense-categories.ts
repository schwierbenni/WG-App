export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Lebensmittel',  slug: 'LEBENSMITTEL',      color: '#16a34a', emoji: '🛒', sortOrder: 1 },
  { name: 'Haushalt',      slug: 'HAUSHALT',           color: '#2563eb', emoji: '🏠', sortOrder: 2 },
  { name: 'Miete & NK',    slug: 'MIETE_NEBENKOSTEN',  color: '#9333ea', emoji: '🏡', sortOrder: 3 },
  { name: 'Sonstiges',     slug: 'SONSTIGES',          color: '#6b7280', emoji: '📝', sortOrder: 4 },
  { name: 'Skat',          slug: 'SKAT',               color: '#d97706', emoji: '🃏', sortOrder: 5 },
  { name: 'Doppelkopf',    slug: 'DOPPELKOPF',         color: '#ea580c', emoji: '🀄', sortOrder: 6 },
] as const
