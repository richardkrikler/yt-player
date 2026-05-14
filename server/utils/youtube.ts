import { google } from 'googleapis'
import { db } from '../db'
import { users, userPlaylists } from '../db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { encrypt, decrypt } from './crypto'

function createOAuthClient() {
  const config = useRuntimeConfig()
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  )
}

export function getAuthUrl(): string {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    scope: ['https://www.googleapis.com/auth/youtube.readonly'],
    access_type: 'offline',
    prompt: 'consent',
  })
}

export async function exchangeCode(code: string) {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function getYoutubeClientForUser(userId: number) {
  const user = await db.select().from(users).where(eq(users.id, userId)).get()
  if (!user?.accessToken || !user?.refreshToken) {
    throw createError({ statusCode: 401, message: 'YouTube account not connected' })
  }

  const client = createOAuthClient()
  client.setCredentials({
    access_token: decrypt(user.accessToken),
    refresh_token: decrypt(user.refreshToken),
    expiry_date: user.tokenExpiresAt ?? undefined,
  })

  client.on('tokens', async (tokens) => {
    await db.update(users).set({
      accessToken: tokens.access_token ? encrypt(tokens.access_token) : user.accessToken,
      tokenExpiresAt: tokens.expiry_date ?? user.tokenExpiresAt,
    }).where(eq(users.id, userId))
  })

  return google.youtube({ version: 'v3', auth: client })
}

/** Find any user who has this playlist and has YouTube connected, and return their client. */
export async function getYoutubeClientForPlaylist(playlistId: string) {
  const row = await db
    .select({ userId: userPlaylists.userId })
    .from(userPlaylists)
    .innerJoin(users, eq(users.id, userPlaylists.userId))
    .where(and(
      eq(userPlaylists.playlistId, playlistId),
      isNotNull(users.accessToken),
      isNotNull(users.refreshToken),
    ))
    .get()

  if (!row) {
    throw createError({ statusCode: 400, message: 'No connected YouTube account available for this playlist' })
  }
  return getYoutubeClientForUser(row.userId)
}

export function getPublicYoutubeClient() {
  const config = useRuntimeConfig()
  return google.youtube({ version: 'v3', auth: config.youtubeApiKey })
}

export function parsePlaylistId(input: string): string | null {
  try {
    const url = new URL(input)
    const listParam = url.searchParams.get('list')
    if (listParam) return listParam
  } catch {
    // not a URL — treat as raw ID
  }
  if (/^PL[A-Za-z0-9_-]{16,}$/.test(input)) return input
  return null
}

export function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  return (Number(match[1] ?? 0) * 3600) + (Number(match[2] ?? 0) * 60) + Number(match[3] ?? 0)
}

export function formatDuration(iso: string): string {
  const seconds = parseDuration(iso)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
