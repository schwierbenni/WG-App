import Anthropic from '@anthropic-ai/sdk'
import { requireWgSession } from '@/lib/api-auth'

const client = new Anthropic()

const SYSTEM_PROMPT = `Du bist ein präziser Kassenbon-Extraktor. Analysiere das Bild eines deutschen Kassenbons und gib ausschließlich ein JSON-Objekt zurück – kein Markdown, keine Erklärungen, nur reines JSON.

Schema:
{
  "shopName": string | null,
  "date": string | null,          // Format: YYYY-MM-DD
  "items": [
    {
      "name": string,              // Artikelname, bereinigt
      "quantity": number,          // Standard: 1
      "unitPrice": number,         // Einzelpreis in Euro
      "totalPrice": number         // Gesamtpreis des Postens in Euro
    }
  ],
  "total": number | null           // Endbetrag in Euro
}

Regeln:
- Nur echte Artikel in "items" – keine Summen, Steuern, Zahlungsmethoden, Pfand, Rabatte
- Artikelnamen auf Deutsch bereinigen, Abkürzungen aufschlüsseln wenn möglich
- Preise als Dezimalzahlen (Punkt als Trennzeichen, z.B. 1.29)
- Datum im ISO-Format YYYY-MM-DD
- Bei unleserlichen Angaben: null setzen`

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response

  const formData = await request.formData()
  const file = formData.get('image') as File | null
  if (!file) {
    return Response.json({ error: 'Kein Bild übermittelt.' }, { status: 400 })
  }

  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return Response.json({ error: 'Bild zu groß (max. 10 MB).' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: 'Extrahiere alle Daten aus diesem Kassenbon als JSON.',
            },
          ],
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    let parsed
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return Response.json({ error: 'Antwort konnte nicht geparst werden.', raw }, { status: 500 })
    }

    return Response.json(parsed)
  } catch (err) {
    console.error('Claude Vision error:', err)
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return Response.json({ error: 'OCR fehlgeschlagen: ' + msg }, { status: 500 })
  }
}
