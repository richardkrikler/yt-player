export const PLAYER_PAGE_SIZE = 50

export function usePlayer(playlistId: Ref<string>) {
  const currentVideo = ref<any>(null)
  const currentPosition = ref(-1)
  const videos = ref<any[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)

  async function fetchPage(p: number) {
    const data = await $fetch<{ total: number; results: any[] }>(
      `/api/playlists/${playlistId.value}/videos`,
      { query: { page: p, limit: PLAYER_PAGE_SIZE } },
    )
    videos.value = data.results
    total.value = data.total
    page.value = p
  }

  async function loadVideos() {
    loading.value = true
    try { await fetchPage(1) }
    finally { loading.value = false }
  }

  async function goToPage(p: number) {
    // Don't set loading — keep old list visible while the new page fetches
    await fetchPage(p)
  }

  function pageForPosition(pos: number) {
    return Math.max(1, Math.ceil((pos + 1) / PLAYER_PAGE_SIZE))
  }

  function play(video: any) {
    currentVideo.value = video
    currentPosition.value = video.item?.position ?? -1
  }

  async function navigateAdjacent(direction: 'next' | 'prev') {
    if (currentPosition.value < 0) return
    try {
      const result = await $fetch<any>(`/api/playlists/${playlistId.value}/videos/adjacent`, {
        query: { position: currentPosition.value, direction },
      })
      play(result)
    }
    catch {
      if (direction === 'next') {
        try {
          const first = await $fetch<any>(`/api/playlists/${playlistId.value}/videos/adjacent`, {
            query: { position: -1, direction: 'next' },
          })
          play(first)
        }
        catch {}
      }
    }
  }

  // Returns the page the video lives on (so the caller can sync its own page ref)
  async function seekToVideo(videoId: string): Promise<number> {
    const inLoaded = videos.value.find(v => v.video?.id === videoId)
    if (inLoaded) { play(inLoaded); return page.value }
    const result = await $fetch<any>(`/api/playlists/${playlistId.value}/videos/find`, {
      query: { videoId },
    })
    const targetPage = pageForPosition(result.item?.position ?? 0)
    await fetchPage(targetPage)
    play(result)
    return targetPage
  }

  async function next() { await navigateAdjacent('next') }
  async function previous() { await navigateAdjacent('prev') }

  async function random() {
    const result = await $fetch<any>(`/api/playlists/${playlistId.value}/videos/random`)
    play(result)
  }

  return {
    currentVideo, currentPosition, videos, loading,
    total, page,
    loadVideos, goToPage, seekToVideo, play, next, previous, random,
  }
}
