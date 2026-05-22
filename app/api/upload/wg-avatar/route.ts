import { requireWgSession } from '@/lib/api-auth'
import { supabase, AVATAR_BUCKET } from '@/lib/supabase'
import { prisma } from '@/lib/db'

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'schwier.b@gmail.com'

export async function POST(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response

  const { session, wgId: sessionWgId } = auth
  const isSuperAdmin = session.user.email === SUPER_ADMIN_EMAIL

  if (session.user.role !== 'ADMIN' && !isSuperAdmin) {
    return Response.json({ error: 'Nur Admins können das WG-Bild ändern.' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'Keine Datei übermittelt.' }, { status: 400 })
  }

  // Super admin may target a different WG via form field
  const targetWgId = (formData.get('wgId') as string | null) ?? sessionWgId
  if (targetWgId !== sessionWgId && !isSuperAdmin) {
    return Response.json({ error: 'Keine Berechtigung.' }, { status: 403 })
  }

  if (file.size > 2 * 1024 * 1024) {
    return Response.json({ error: 'Datei ist zu groß (max. 2 MB).' }, { status: 400 })
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    return Response.json({ error: 'Nur JPEG, PNG, WebP oder GIF erlaubt.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `wg/${targetWgId}/avatar.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return Response.json({ error: 'Upload fehlgeschlagen: ' + uploadError.message }, { status: 500 })
  }

  const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  const avatarUrl = publicData.publicUrl + `?t=${Date.now()}`

  await prisma.wGConfig.update({ where: { id: targetWgId }, data: { avatarUrl } })

  return Response.json({ avatarUrl })
}

export async function DELETE(request: Request) {
  const auth = await requireWgSession()
  if (!auth.ok) return auth.response
  const { session, wgId: sessionWgId } = auth
  const isSuperAdmin = session.user.email === SUPER_ADMIN_EMAIL

  if (session.user.role !== 'ADMIN' && !isSuperAdmin) {
    return Response.json({ error: 'Nur Admins können das WG-Bild ändern.' }, { status: 403 })
  }

  const url = new URL(request.url)
  const targetWgId = url.searchParams.get('wgId') ?? sessionWgId
  if (targetWgId !== sessionWgId && !isSuperAdmin) {
    return Response.json({ error: 'Keine Berechtigung.' }, { status: 403 })
  }

  await prisma.wGConfig.update({ where: { id: targetWgId }, data: { avatarUrl: null } })
  return Response.json({ ok: true })
}
