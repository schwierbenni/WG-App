import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const g = globalThis as unknown as { _prisma?: PrismaClient }

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL ist nicht konfiguriert. ' +
      'Bitte setze die Variable in Vercel (Project Settings → Environment Variables).'
    )
  }

  // Supabase and most managed Postgres providers require SSL in production.
  // We pass ssl via the pg pool config so it works regardless of whether
  // the connection string already contains ?sslmode=require.
  const ssl =
    process.env.NODE_ENV === 'production' &&
    !connectionString.includes('sslmode=disable')
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
