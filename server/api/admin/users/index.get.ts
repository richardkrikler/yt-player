import { db } from '../../../db'
import { users } from '../../../db/schema'
import { requireAdmin } from '../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return db.select({
    id: users.id,
    email: users.email,
    displayName: users.displayName,
    role: users.role,
    youtubeConnectedAt: users.youtubeConnectedAt,
    createdAt: users.createdAt,
  }).from(users)
})
