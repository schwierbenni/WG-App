import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { EventEmitter } from 'node:events'
const tools = createRequire(resolve('.tools/test-db/package.json'))
const { PGlite } = tools('@electric-sql/pglite')
const require = createRequire(resolve('package.json'))
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
export async function createTestDatabase() {
  const db = new PGlite()
  await db.waitReady
  const pool = new Pool()
  const query = async (input, values) => {
    const text = typeof input === 'string' ? input : input.text
    const result = await db.query(text, values ?? input.values ?? [], {
      rowMode: input.rowMode ?? 'object',
      parsers: Object.fromEntries(
        [20, 1082, 1114, 1184, 114, 3802].map((oid) => [
          oid,
          input.types?.getTypeParser(oid, 'text') ?? ((s) => s),
        ]),
      ),
    })
    return {
      rows: result.rows,
      fields: result.fields,
      rowCount: result.affectedRows ?? result.rows.length,
    }
  }
  pool.query = query
  pool.connect = async () => {
    const conn = new EventEmitter()
    conn.query = query
    conn.release = () => {}
    return conn
  }
  pool.end = async () => {}
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  return {
    db,
    prisma,
    close: async () => {
      await prisma.$disconnect()
      await db.close()
    },
  }
}
