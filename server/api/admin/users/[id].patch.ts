import { db } from '../../../db'
import { users } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const { role } = await readBody<{ role?: 'admin' | 'user' }>(event)

  if (!role || !['admin', 'user'].includes(role)) {
    throw createError({ statusCode: 400, message: 'role must be admin or user' })
  }

  // Refuse if demoting the last admin
  if (role === 'user') {
    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id))
    if (target?.role === 'admin') {
      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'))
      if (admins.length <= 1) {
        throw createError({ statusCode: 400, message: 'Cannot demote the last admin account' })
      }
    }
  }

  const [updated] = await db.update(users)
    .set({ role })
    .where(eq(users.id, id))
    .returning({ id: users.id, email: users.email, role: users.role })

  if (!updated) throw createError({ statusCode: 404, message: 'User not found' })
  return updated
})
