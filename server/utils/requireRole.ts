import type { H3Event } from 'h3'

export async function requireAuth(event: H3Event) {
  const { user } = await requireUserSession(event)
  return user
}

export async function requireAdmin(event: H3Event) {
  const user = await requireAuth(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  return user
}
