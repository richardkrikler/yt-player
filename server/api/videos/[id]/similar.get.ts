import { db, sqlite } from '../../../db'
import { videos, playlistItems, playlists, userPlaylists, playlistShares } from '../../../db/schema'
import { eq, and, inArray, ne } from 'drizzle-orm'
import { requireAuth } from '../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const videoId = getRouterParam(event, 'id')!
  const { crossPlaylist, playlistId: scopePlaylist, limit: limitParam } = getQuery(event)
  const limit = Math.min(12, Math.max(1, parseInt(limitParam as string) || 6))

  // Source video
  const source = await db.select().from(videos).where(eq(videos.id, videoId)).get()
  if (!source) throw createError({ statusCode: 404, message: 'Video not found' })

  // Build FTS query from tags + title keywords
  const tags: string[] = source.tags ? (() => { try { return JSON.parse(source.tags!) } catch { return [] } })() : []
  const titleWords = source.title
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
  const terms = [...new Set([...tags, ...titleWords])].slice(0, 15)

  if (terms.length === 0) return []

  // Escape and build OR query
  const ftsQuery = terms.map(t => `"${t.replace(/"/g, '').replace(/\*/g, '')}"`).join(' OR ')

  // FTS with same column weights as global search; exclude the source video
  const ftsRows = sqlite.prepare(
    `SELECT id FROM videos_fts
     WHERE videos_fts MATCH ? AND id != ?
     ORDER BY bm25(videos_fts, 0, 10, 1, 2, 5)
     LIMIT 100`,
  ).all(ftsQuery, videoId) as { id: string }[]

  if (ftsRows.length === 0) return []
  const candidateIds = ftsRows.map(r => r.id)

  // Accessible playlists
  const ownedRows = await db.select({ playlistId: userPlaylists.playlistId })
    .from(userPlaylists).where(eq(userPlaylists.userId, user.id))
  const sharedRows = await db.select({ playlistId: playlistShares.playlistId })
    .from(playlistShares).where(eq(playlistShares.toUserId, user.id))

  let accessibleIds = [
    ...ownedRows.map(r => r.playlistId),
    ...sharedRows.map(r => r.playlistId),
  ]
  if (accessibleIds.length === 0) return []

  // Optionally scope to a single playlist
  if (crossPlaylist !== 'true' && scopePlaylist && typeof scopePlaylist === 'string') {
    if (accessibleIds.includes(scopePlaylist)) accessibleIds = [scopePlaylist]
  }

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
    .where(and(
      inArray(playlistItems.playlistId, accessibleIds),
      inArray(videos.id, candidateIds),
      ne(videos.id, videoId),
    ))
    .limit(100)

  // Restore FTS rank order and deduplicate by video ID (keep first occurrence)
  const rankMap = new Map(candidateIds.map((id, i) => [id, i]))
  const seen = new Set<string>()
  return rows
    .sort((a, b) => (rankMap.get(a.video.id) ?? 999) - (rankMap.get(b.video.id) ?? 999))
    .filter((r) => { if (seen.has(r.video.id)) return false; seen.add(r.video.id); return true })
    .slice(0, limit)
})
