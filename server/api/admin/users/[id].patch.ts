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

  const [updated] = await db.update(users)
    .set({ role })
    .where(eq(users.id, id))
    .returning({ id: users.id, email: users.email, role: users.role })

  if (!updated) throw createError({ statusCode: 404, message: 'User not found' })
  return updated
})
