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

  // Refuse if this would remove the last admin
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id))
  if (target?.role === 'admin') {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'))
    if (admins.length <= 1) {
      throw createError({ statusCode: 400, message: 'Cannot delete the last admin account' })
    }
  }

  await db.delete(users).where(eq(users.id, id))
  return { ok: true }
})
