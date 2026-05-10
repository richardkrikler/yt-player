import { exchangeCode } from '../../utils/youtube'
import { encrypt } from '../../utils/crypto'
import { db } from '../../db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { code } = getQuery(event)

  if (!code || typeof code !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing authorization code' })
  }

  const tokens = await exchangeCode(code)

  if (!tokens.access_token || !tokens.refresh_token) {
    throw createError({ statusCode: 400, message: 'Incomplete tokens from Google — ensure offline access is granted' })
  }

  await db.update(users).set({
    accessToken: encrypt(tokens.access_token),
    refreshToken: encrypt(tokens.refresh_token),
    tokenExpiresAt: tokens.expiry_date ?? null,
    youtubeConnectedAt: Date.now(),
  }).where(eq(users.id, session.user.id))

  await setUserSession(event, {
    user: { ...session.user, youtubeConnected: true },
  })

  return sendRedirect(event, '/settings?connected=1')
})
