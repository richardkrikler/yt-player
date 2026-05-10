const METADATA_TTL = 24 * 60 * 60 * 1000 // 24 h
const VIDEOS_TTL = 6 * 60 * 60 * 1000    //  6 h

export function isMetadataStale(cachedAt: number | null | undefined): boolean {
  if (!cachedAt) return true
  return Date.now() - cachedAt > METADATA_TTL
}

export function isVideoListStale(cachedAt: number | null | undefined): boolean {
  if (!cachedAt) return true
  return Date.now() - cachedAt > VIDEOS_TTL
}
