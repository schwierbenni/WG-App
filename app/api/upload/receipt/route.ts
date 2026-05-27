import { requireWgSession } from '@/lib/api-auth'
import { supabase, RECEIPT_BUCKET } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response

  const { session } = auth
  const userId = session.user.id

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'Keine Datei übermittelt.' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'Datei ist zu groß (max. 10 MB).' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: 'Nur JPEG, PNG, WebP oder HEIC erlaubt.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/${uuidv4()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return Response.json({ error: 'Upload fehlgeschlagen: ' + uploadError.message }, { status: 500 })
  }

  const { data: publicData } = supabase.storage.from(RECEIPT_BUCKET).getPublicUrl(path)
  return Response.json({ url: publicData.publicUrl })
}
