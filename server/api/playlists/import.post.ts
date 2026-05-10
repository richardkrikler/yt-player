import { db } from '../../db'
import { playlists, userPlaylists } from '../../db/schema'
import { getYoutubeClientForUser } from '../../utils/youtube'
import { requireAuth } from '../../utils/requireRole'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { ids } = await readBody<{ ids: string[] }>(event)

  if (!Array.isArray(ids) || ids.length === 0) {
    throw createError({ statusCode: 400, message: 'ids must be a non-empty array' })
  }

  const youtube = await getYoutubeClientForUser(user.id)
  const res = await youtube.playlists.list({
    part: ['snippet', 'contentDetails', 'status'],
    id: ids,
    maxResults: 50,
  })

  const imported: string[] = []

  for (const item of res.data.items ?? []) {
    if (!item.id) continue

    const existing = await db.select({ id: playlists.id }).from(playlists)
      .where(eq(playlists.id, item.id)).get()

    if (!existing) {
      await db.insert(playlists).values({
        id: item.id,
        ownerUserId: user.id,
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
      playlistId: item.id,
      addedAt: Date.now(),
    }).onConflictDoNothing()

    imported.push(item.id)
  }

  return { imported }
})
