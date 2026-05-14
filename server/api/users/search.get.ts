import { db } from '../../db'
import { users } from '../../db/schema'
import { like, or, and, ne } from 'drizzle-orm'
import { requireAuth } from '../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { q } = getQuery(event)

  if (!q || typeof q !== 'string' || q.trim().length < 2) return []

  const term = `%${q.trim()}%`

  return db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(and(ne(users.id, user.id), or(like(users.email, term), like(users.displayName, term))))
    .limit(10)
})
