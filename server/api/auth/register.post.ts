import bcrypt from 'bcryptjs'
import { db } from '../../db'
import { users } from '../../db/schema'
import { eq, count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { email, password, displayName } = await readBody<{
    email: string
    password: string
    displayName?: string
  }>(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password are required' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, message: 'Password must be at least 8 characters' })
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).get()
  if (existing) {
    throw createError({ statusCode: 409, message: 'Email already registered' })
  }

  const [{ total }] = await db.select({ total: count() }).from(users)
  const role: 'admin' | 'user' = total === 0 ? 'admin' : 'user'

  const passwordHash = await bcrypt.hash(password, 12)

  const [user] = await db.insert(users).values({
    email,
    passwordHash,
    displayName: displayName ?? null,
    role,
    createdAt: Date.now(),
  }).returning()

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role as 'admin' | 'user',
      youtubeConnected: false,
    },
  })

  return { id: user.id, email: user.email, role: user.role }
})
