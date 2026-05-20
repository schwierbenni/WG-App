import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const g = globalThis as unknown as { _prisma?: PrismaClient }

function sanitize(url: string): string {
  try {
    const u = new URL(url)
    // Remove params that conflict with the pg pool ssl config or are
    // Prisma URL-mode hints not understood by the pg driver adapter.
    u.searchParams.delete('sslmode')
    u.searchParams.delete('pgbouncer')
    u.searchParams.delete('connection_limit')
    return u.toString()
  } catch {
    return url
  }
}

function createClient(): PrismaClient {
  const raw = process.env.DATABASE_URL
  if (!raw) {
    throw new Error(
      'DATABASE_URL ist nicht konfiguriert. ' +
      'Bitte setze die Variable in Vercel (Project Settings → Environment Variables).'
    )
  }
}

  const connectionString = sanitize(raw)

  // Always use SSL in production; rejectUnauthorized:false accepts
  // Supabase’s certificate chain without needing the CA in the trust store.
  const ssl = process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined

  const adapter = new PrismaPg({ connectionString, ssl })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

function getClient(): PrismaClient {
  g._prisma ??= createClient()
  return g._prisma
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
