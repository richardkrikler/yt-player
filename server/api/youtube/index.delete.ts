import { db } from '../../db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  await db.update(users).set({
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    youtubeConnectedAt: null,
    googleId: null,
  }).where(eq(users.id, session.user.id))

  await setUserSession(event, {
    user: { ...session.user, youtubeConnected: false },
  })

  return { ok: true }
})
