import Anthropic from '@anthropic-ai/sdk'
import { requireWgSession } from '@/lib/api-auth'

const client = new Anthropic()

const SYSTEM_PROMPT = `Du bist ein präziser Kassenbon-Extraktor. Analysiere das Bild eines deutschen Kassenbons und gib ausschließlich ein JSON-Objekt zurück – kein Markdown, keine Erklärungen, nur reines JSON.

Schema:
{
  "shopName": string | null,
  "date": string | null,
  "items": [
    {
      "name": string,
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number
    }
  ],
  "total": number | null
}

Regeln:
- Nur echte Artikel in "items" – keine Summen, Steuern, Zahlungsmethoden, Pfand, Rabatte
- Artikelnamen bereinigen, Abkürzungen aufschlüsseln wenn möglich
- Preise als Dezimalzahlen mit Punkt (z.B. 1.29)
- Datum im ISO-Format YYYY-MM-DD
- Bei unleserlichen Angaben: null`

function extractJson(raw: string): string {
  // Find outermost { } – handles markdown fences and extra text around JSON
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('Kein JSON-Objekt gefunden')
  return raw.slice(start, end + 1)
}

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response

  const formData = await request.formData()
  const file = formData.get('image') as File | null
  if (!file) return Response.json({ error: 'Kein Bild übermittelt.' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: 'Bild zu groß (max. 10 MB).' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
    ? file.type
    : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Extrahiere alle Daten aus diesem Kassenbon als JSON.' },
        ],
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    let parsed: unknown
    try {
      parsed = JSON.parse(extractJson(raw))
    } catch (e) {
      console.error('JSON parse failed, raw response:', raw)
      return Response.json({ error: 'Antwort konnte nicht geparst werden: ' + (e instanceof Error ? e.message : String(e)), raw }, { status: 500 })
    }

    return Response.json(parsed)
  } catch (err) {
    console.error('Claude Vision error:', err)
    return Response.json({ error: 'OCR fehlgeschlagen: ' + (err instanceof Error ? err.message : 'Unbekannter Fehler') }, { status: 500 })
  }
}
