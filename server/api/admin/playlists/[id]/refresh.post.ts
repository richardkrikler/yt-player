import { db } from '../../../../db'
import { playlists } from '../../../../db/schema'
import { getYoutubeClientForPlaylist, getPublicYoutubeClient } from '../../../../utils/youtube'
import { requireAdmin } from '../../../../utils/requireRole'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!

  const playlist = await db.select().from(playlists).where(eq(playlists.id, id)).get()
  if (!playlist) throw createError({ statusCode: 404, message: 'Playlist not found' })

  const youtube = playlist.privacyStatus === 'public'
    ? getPublicYoutubeClient()
    : await getYoutubeClientForPlaylist(id)

  const res = await youtube.playlists.list({
    part: ['snippet', 'contentDetails', 'status'],
    id: [id],
  })

  const item = res.data.items?.[0]
  if (!item) throw createError({ statusCode: 404, message: 'Playlist not found on YouTube' })

  const [updated] = await db.update(playlists).set({
    title: item.snippet?.title ?? playlist.title,
    itemCount: item.contentDetails?.itemCount ?? playlist.itemCount,
    thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? null,
    privacyStatus: item.status?.privacyStatus ?? null,
    metadataCachedAt: Date.now(),
  }).where(eq(playlists.id, id)).returning()

  return updated
})
