import { db } from '../../db'
import { playlists, userPlaylists } from '../../db/schema'
import { getPublicYoutubeClient, parsePlaylistId } from '../../utils/youtube'
import { requireAuth } from '../../utils/requireRole'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { url } = await readBody<{ url: string }>(event)

  if (!url) {
    throw createError({ statusCode: 400, message: 'url is required' })
  }

  const playlistId = parsePlaylistId(url.trim())
  if (!playlistId) {
    throw createError({ statusCode: 400, message: 'Could not extract a playlist ID from the provided URL' })
  }

  const existing = await db.select({ id: playlists.id }).from(playlists)
    .where(eq(playlists.id, playlistId)).get()

  if (!existing) {
    const youtube = getPublicYoutubeClient()
    const res = await youtube.playlists.list({
      part: ['snippet', 'contentDetails', 'status'],
      id: [playlistId],
    })

    const item = res.data.items?.[0]
    if (!item) {
      throw createError({ statusCode: 404, message: 'Playlist not found on YouTube' })
    }

    await db.insert(playlists).values({
      id: playlistId,
      title: item.snippet?.title ?? 'Untitled',
      description: item.snippet?.description ?? null,
      channelTitle: item.snippet?.channelTitle ?? null,
      channelId: item.snippet?.channelId ?? null,
      itemCount: item.contentDetails?.itemCount ?? 0,
      privacyStatus: item.status?.privacyStatus ?? null,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? null,
      metadataCachedAt: Date.now(),
      createdAt: Date.now(),
    })
  }

  await db.insert(userPlaylists).values({
    userId: user.id,
    playlistId,
    addedAt: Date.now(),
  }).onConflictDoNothing()

  return { playlistId }
})
