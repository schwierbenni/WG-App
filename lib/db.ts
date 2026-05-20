import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const g = globalThis as unknown as { _prisma?: PrismaClient }

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL ist nicht konfiguriert. ' +
      'Bitte setze die Variable in Vercel (Project Settings → Environment Variables) oder in der lokalen .env Datei.'
    )
  }
  const adapter = new PrismaPg({ connectionString })
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
    return (getClient() as Record<string | symbol, unknown>)[prop as string]
  },
})
