import { db } from '../../../../db'
import { playlists, playlistItems, videos } from '../../../../db/schema'
import { getYoutubeClientForPlaylist, getPublicYoutubeClient } from '../../../../utils/youtube'
import { requireAdmin } from '../../../../utils/requireRole'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!

  const playlist = await db.select().from(playlists).where(eq(playlists.id, id)).get()
  if (!playlist) throw createError({ statusCode: 404, message: 'Playlist not found' })

  try {
    const youtube = playlist.privacyStatus === 'public'
      ? getPublicYoutubeClient()
      : await getYoutubeClientForPlaylist(id)

    // Refresh metadata
    const metaRes = await youtube.playlists.list({
      part: ['snippet', 'contentDetails', 'status'],
      id: [id],
    })
    const item = metaRes.data.items?.[0]
    if (!item) throw createError({ statusCode: 404, message: 'Playlist not found on YouTube' })

    // Fetch all playlist items (paginated)
    const allItems: any[] = []
    let pageToken: string | undefined
    do {
      const res = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId: id,
        maxResults: 50,
        pageToken,
      })
      allItems.push(...(res.data.items ?? []))
      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)

    // Fetch video details in batches of 50
    const videoIds = [...new Set(allItems.map(i => i.contentDetails?.videoId).filter(Boolean) as string[])]
    const allVideoDetails: any[] = []
    for (let i = 0; i < videoIds.length; i += 50) {
      const res = await youtube.videos.list({
        part: ['snippet', 'contentDetails'],
        id: videoIds.slice(i, i + 50),
      })
      allVideoDetails.push(...(res.data.items ?? []))
    }

    for (const detail of allVideoDetails) {
      if (!detail.id) continue
      await db.insert(videos).values({
        id: detail.id,
        title: detail.snippet?.title ?? 'Untitled',
        description: detail.snippet?.description ?? null,
        channelTitle: detail.snippet?.channelTitle ?? null,
        channelId: detail.snippet?.channelId ?? null,
        thumbnailUrl: detail.snippet?.thumbnails?.medium?.url ?? null,
        duration: detail.contentDetails?.duration ?? null,
        publishedAt: detail.snippet?.publishedAt ? new Date(detail.snippet.publishedAt).getTime() : null,
        tags: detail.snippet?.tags ? JSON.stringify(detail.snippet.tags) : null,
        cachedAt: Date.now(),
      }).onConflictDoUpdate({
        target: videos.id,
        set: {
          title: detail.snippet?.title ?? 'Untitled',
          description: detail.snippet?.description ?? null,
          thumbnailUrl: detail.snippet?.thumbnails?.medium?.url ?? null,
          duration: detail.contentDetails?.duration ?? null,
          tags: detail.snippet?.tags ? JSON.stringify(detail.snippet.tags) : null,
          cachedAt: Date.now(),
        },
      })
    }

    const videoDetailMap = new Map(allVideoDetails.map(v => [v.id, v]))
    await db.delete(playlistItems).where(eq(playlistItems.playlistId, id))
    for (const pi of allItems) {
      const videoId = pi.contentDetails?.videoId
      if (!videoId || !videoDetailMap.has(videoId)) continue
      await db.insert(playlistItems).values({
        id: pi.id!,
        playlistId: id,
        videoId,
        position: pi.snippet?.position ?? 0,
        addedAt: pi.snippet?.publishedAt ? new Date(pi.snippet.publishedAt).getTime() : null,
      }).onConflictDoNothing()
    }

    const [updated] = await db.update(playlists).set({
      title: item.snippet?.title ?? playlist.title,
      description: item.snippet?.description ?? null,
      itemCount: item.contentDetails?.itemCount ?? playlist.itemCount,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? null,
      privacyStatus: item.status?.privacyStatus ?? null,
      metadataCachedAt: Date.now(),
      videosCachedAt: Date.now(),
    }).where(eq(playlists.id, id)).returning()

    return updated
  }
  catch (e: any) {
    if (e?.message === 'invalid_grant' || e?.statusCode === 401) {
      throw createError({ statusCode: 401, message: 'YouTube authorization expired. Please reconnect.' })
    }
    throw e
  }
})
