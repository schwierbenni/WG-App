export interface ParsedReceiptItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  selected: boolean
}

export interface ParsedReceipt {
  shopName: string | null
  date: string | null
  items: ParsedReceiptItem[]
  total: number | null
}

// Matches German-formatted prices: 1,29 or 12,99 or -0,50
const PRICE_RE = /-?\d+,\d{2}/g

// Lines that are NOT article items (totals, tax, payment lines, etc.)
const SKIP_KEYWORDS = [
  'summe', 'gesamt', 'gesamtbetrag', 'total', 'zwischensumme',
  'mwst', 'mwst.', 'steuer', 'ust', 'mehrwertsteuer',
  'gegeben', 'gegeben bar', 'rückgeld', 'rückgaben', 'rückgabe', 'wechselgeld',
  'bar', 'karte', 'ec', 'mastercard', 'visa', 'paypal',
  'kassenbon', 'kassierer', 'kassennr', 'bon-nr', 'bon nr', 'beleg-nr',
  'filiale', 'markt', 'datum', 'uhrzeit', 'uhr', 'danke',
  'pfand', 'pfandbon', 'leergut',
  'rabatt', 'gutschein', 'coupon',
  'eur', '€',
  '---', '===', '***',
]

function germanPriceToFloat(price: string): number {
  return parseFloat(price.replace(',', '.'))
}

function parseId(): string {
  return Math.random().toString(36).slice(2, 9)
}

function isSkipLine(line: string): boolean {
  const lower = line.toLowerCase().trim()
  return SKIP_KEYWORDS.some((kw) => lower.startsWith(kw) || lower === kw)
}

function extractDate(lines: string[]): string | null {
  // German date formats: dd.mm.yyyy, dd.mm.yy, dd/mm/yyyy
  const DATE_RE = /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/
  for (const line of lines) {
    const m = line.match(DATE_RE)
    if (m) {
      const [, day, month, year] = m
      const fullYear = year.length === 2 ? `20${year}` : year
      return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
  }
  return null
}

function extractShopName(lines: string[]): string | null {
  // Shop name is usually within the first 5 non-empty lines, before address/items
  const candidates = lines
    .slice(0, 8)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && l.length < 60)
    .filter((l) => !/^\d/.test(l)) // doesn't start with digit
    .filter((l) => !l.match(PRICE_RE))   // no price on this line

  return candidates[0] ?? null
}

function extractTotal(lines: string[]): number | null {
  const TOTAL_KEYWORDS = ['summe', 'gesamtbetrag', 'gesamt', 'total', 'zwischensumme', 'zu zahlen']
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (TOTAL_KEYWORDS.some((kw) => lower.includes(kw))) {
      const prices = line.match(PRICE_RE)
      if (prices) {
        // Take the last price on the line (often the amount after discount)
        return germanPriceToFloat(prices[prices.length - 1])
      }
    }
  }
  return null
}

function extractItems(lines: string[]): ParsedReceiptItem[] {
  const items: ParsedReceiptItem[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim()
    if (!raw || raw.length < 3) continue
    if (isSkipLine(raw)) continue

    // Must end with a price-like pattern
    const prices = raw.match(PRICE_RE)
    if (!prices) continue

    // The last price on the line is the item total price
    const totalPriceStr = prices[prices.length - 1]
    const totalPrice = germanPriceToFloat(totalPriceStr)
    if (isNaN(totalPrice) || totalPrice <= 0) continue

    // Strip price(s) + trailing tax indicators (A, B, *) from item name
    let name = raw
      .replace(PRICE_RE, '')
      .replace(/\s+[AB*]\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    if (!name || name.length < 2) continue

    // Quantity: look for "2x", "3 x" or "2 * 0,99" patterns
    let quantity = 1
    let unitPrice = totalPrice

    const qtyPattern = /^(\d+)\s*[xX*]\s*/
    const qtyMatch = name.match(qtyPattern)
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10)
      name = name.replace(qtyPattern, '').trim()
      unitPrice = totalPrice / quantity
    } else if (prices.length >= 2) {
      // Some receipts: "2 x 0,99   1,98"
      // If multiple prices, first might be unit price
      const maybeUnit = germanPriceToFloat(prices[0])
      const maybeTotal = germanPriceToFloat(prices[prices.length - 1])
      if (!isNaN(maybeUnit) && maybeUnit > 0 && Math.abs(maybeUnit - maybeTotal) > 0.005) {
        const inferredQty = Math.round(maybeTotal / maybeUnit)
        if (inferredQty > 1 && Math.abs(inferredQty * maybeUnit - maybeTotal) < 0.02) {
          quantity = inferredQty
          unitPrice = maybeUnit
        }
      }
    }

    items.push({
      id: parseId(),
      name,
      quantity,
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      selected: true,
    })
  }

  return items
}

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  return {
    shopName: extractShopName(lines),
    date: extractDate(lines),
    items: extractItems(lines),
    total: extractTotal(lines),
  }
}
