import { db } from '../../../db'
import { playlists, playlistItems, videos, userPlaylists, playlistShares } from '../../../db/schema'
import { getYoutubeClientForPlaylist, getPublicYoutubeClient, clearYoutubeTokens } from '../../../utils/youtube'
import { requireAuth } from '../../../utils/requireRole'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const playlistId = getRouterParam(event, 'id')!

  const playlist = await db.select().from(playlists).where(eq(playlists.id, playlistId)).get()
  if (!playlist) throw createError({ statusCode: 404, message: 'Playlist not found' })

  const owned = await db.select({ playlistId: userPlaylists.playlistId }).from(userPlaylists)
    .where(and(eq(userPlaylists.userId, user.id), eq(userPlaylists.playlistId, playlistId))).get()

  if (!owned) {
    const shared = await db.select({ id: playlistShares.id }).from(playlistShares)
      .where(and(eq(playlistShares.toUserId, user.id), eq(playlistShares.playlistId, playlistId))).get()
    if (!shared) throw createError({ statusCode: 403, message: 'Access denied' })
  }

  try {
  const youtube = playlist.privacyStatus === 'public'
    ? getPublicYoutubeClient()
    : await getYoutubeClientForPlaylist(playlistId)

  // fetch all playlist items (paginated)
  const allItems: any[] = []
  let pageToken: string | undefined
  do {
    const res = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId,
      maxResults: 50,
      pageToken,
    })
    allItems.push(...(res.data.items ?? []))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  // collect unique video IDs
  const videoIds = [...new Set(
    allItems.map(i => i.contentDetails?.videoId).filter(Boolean) as string[],
  )]

  // fetch video details in batches of 50
  const allVideoDetails: any[] = []
  for (let i = 0; i < videoIds.length; i += 50) {
    const res = await youtube.videos.list({
      part: ['snippet', 'contentDetails'],
      id: videoIds.slice(i, i + 50),
    })
    allVideoDetails.push(...(res.data.items ?? []))
  }

  const videoDetailMap = new Map(allVideoDetails.map(v => [v.id, v]))

  // upsert video metadata
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
      publishedAt: detail.snippet?.publishedAt
        ? new Date(detail.snippet.publishedAt).getTime()
        : null,
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

  // rebuild playlist items
  await db.delete(playlistItems).where(eq(playlistItems.playlistId, playlistId))

  for (const item of allItems) {
    const videoId = item.contentDetails?.videoId
    if (!videoId || !videoDetailMap.has(videoId)) continue

    await db.insert(playlistItems).values({
      id: item.id!,
      playlistId,
      videoId,
      position: item.snippet?.position ?? 0,
      addedAt: item.snippet?.publishedAt
        ? new Date(item.snippet.publishedAt).getTime()
        : null,
    }).onConflictDoNothing()
  }

  await db.update(playlists)
    .set({ videosCachedAt: Date.now(), itemCount: allItems.length })
    .where(eq(playlists.id, playlistId))

  return { count: allItems.length }
  }
  catch (e: any) {
    if (e?.message === 'invalid_grant' || e?.statusCode === 401) {
      if (user.youtubeConnected) {
        await clearYoutubeTokens(user.id)
        await setUserSession(event, { user: { ...user, youtubeConnected: false } })
      }
      throw createError({ statusCode: 401, message: 'YouTube authorization expired. Please reconnect.' })
    }
    throw e
  }
})
