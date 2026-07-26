import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

function createDb() {
  const sql = neon(process.env.DATABASE_URL!)
  return drizzle(sql, { schema })
}

// Lazy so `next build` does not crash when DATABASE_URL is absent at build
// time. Deliberately a plain function rather than a Proxy wrapper: Proxies
// break libraries that introspect the client object.
let _db: ReturnType<typeof createDb> | null = null

export function getDb() {
  if (!_db) _db = createDb()
  return _db
}
