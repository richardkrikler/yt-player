import { db } from '../../../db'
import { users } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (id === admin.id) {
    throw createError({ statusCode: 400, message: 'Cannot delete your own account' })
  }

  await db.delete(users).where(eq(users.id, id))
  return { ok: true }
})
