import { db, sqlite } from '../db'
import { videos, playlistItems, playlists, userPlaylists, playlistShares } from '../db/schema'
import { eq, and, inArray, like, gte, lte } from 'drizzle-orm'
import { requireAuth } from '../utils/requireRole'

/** Convert ISO 8601 duration (e.g. "PT1H4M33S") to total seconds. */
function isoDurationToSeconds(iso: string | null | undefined): number | null {
  if (!iso) return null
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return null
  return (parseInt(m[1] ?? '0') * 3600)
    + (parseInt(m[2] ?? '0') * 60)
    + parseInt(m[3] ?? '0')
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const {
    q,
    author,
    playlist,
    durationMin,
    durationMax,
    publishedAfter,
    publishedBefore,
    page: pageParam,
    pageSize: pageSizeParam,
  } = getQuery(event)

  const page = Math.max(1, parseInt(pageParam as string) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(pageSizeParam as string) || 20))

  const hasQ = typeof q === 'string' && q.trim().length >= 2
  const hasAuthor = typeof author === 'string' && author.trim().length > 0
  const hasPlaylist = typeof playlist === 'string' && playlist.length > 0
  const hasDuration = durationMin !== undefined || durationMax !== undefined
  const hasDate = publishedAfter !== undefined || publishedBefore !== undefined

  if (!hasQ && !hasAuthor && !hasPlaylist && !hasDuration && !hasDate) {
    throw createError({ statusCode: 400, message: 'At least one filter is required' })
  }

  // Collect accessible playlist IDs for this user
  const ownedRows = await db
    .select({ playlistId: userPlaylists.playlistId })
    .from(userPlaylists)
    .where(eq(userPlaylists.userId, user.id))

  const sharedRows = await db
    .select({ playlistId: playlistShares.playlistId })
    .from(playlistShares)
    .where(eq(playlistShares.toUserId, user.id))

  let accessibleIds = [
    ...ownedRows.map(r => r.playlistId),
    ...sharedRows.map(r => r.playlistId),
  ]

  if (accessibleIds.length === 0) return { total: 0, page, pageSize, results: [] }

  // Narrow to a single playlist if requested, with access check
  if (hasPlaylist) {
    if (!accessibleIds.includes(playlist as string)) {
      throw createError({ statusCode: 403, message: 'Access denied' })
    }
    accessibleIds = [playlist as string]
  }

  // FTS for text query — raises limit so downstream filters can still apply.
  // bm25 column weights (must match FTS table column order):
  //   col 0  id           UNINDEXED → 0
  //   col 1  title                  → 10  (highest — video title)
  //   col 2  description            → 1   (lowest  — usually not visible)
  //   col 3  tags                   → 2
  //   col 4  channel_title          → 5   (second  — artist/channel)
  let videoIdFilter: string[] | null = null
  if (hasQ) {
    const ftsRows = sqlite.prepare(
      `SELECT id FROM videos_fts WHERE videos_fts MATCH ? ORDER BY bm25(videos_fts, 0, 10, 1, 2, 5) LIMIT 500`,
    ).all((q as string).trim() + '*') as { id: string }[]
    videoIdFilter = ftsRows.map(r => r.id)
    if (videoIdFilter.length === 0) return { total: 0, page, pageSize, results: [] }
  }

  // Build WHERE conditions
  const conditions: ReturnType<typeof eq>[] = [
    inArray(playlistItems.playlistId, accessibleIds),
  ]
  if (videoIdFilter) conditions.push(inArray(videos.id, videoIdFilter))
  if (hasAuthor) conditions.push(like(videos.channelTitle, `%${(author as string).trim()}%`))
  if (publishedAfter !== undefined) conditions.push(gte(videos.publishedAt, Number(publishedAfter)))
  if (publishedBefore !== undefined) conditions.push(lte(videos.publishedAt, Number(publishedBefore)))

  const rows = await db
    .select({
      item: playlistItems,
      video: videos,
      playlist: playlists,
      customTitle: userPlaylists.customTitle,
    })
    .from(playlistItems)
    .innerJoin(videos, eq(playlistItems.videoId, videos.id))
    .innerJoin(playlists, eq(playlistItems.playlistId, playlists.id))
    .leftJoin(userPlaylists, and(
      eq(userPlaylists.playlistId, playlists.id),
      eq(userPlaylists.userId, user.id),
    ))
    .where(and(...conditions))
    .limit(500)

  // Restore FTS rank order (the inArray JOIN loses it)
  if (videoIdFilter) {
    const rankMap = new Map(videoIdFilter.map((id, i) => [id, i]))
    rows.sort((a, b) => (rankMap.get(a.video.id) ?? Infinity) - (rankMap.get(b.video.id) ?? Infinity))
  }

  // Duration is stored as ISO 8601 text — post-filter in JS
  const allResults = hasDuration
    ? rows.filter((row) => {
        const minS = durationMin !== undefined ? Number(durationMin) : 0
        const maxS = durationMax !== undefined ? Number(durationMax) : Infinity
        const secs = isoDurationToSeconds(row.video.duration)
        if (secs === null) return false
        return secs >= minS && secs <= maxS
      })
    : rows

  const total = allResults.length
  const start = (page - 1) * pageSize
  const results = allResults.slice(start, start + pageSize)

  return { total, page, pageSize, results }
})
