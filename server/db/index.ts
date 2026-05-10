import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import * as schema from './schema'

const dbPath = process.env.DATABASE_URL || './data/yt-player.db'
mkdirSync(dirname(resolve(dbPath)), { recursive: true })

export const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
