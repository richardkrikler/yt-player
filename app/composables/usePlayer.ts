const PAGE_SIZE = 50
const WINDOW_PAGES = 3  // 150 videos in memory at a time

function posToPage(position: number) {
  return Math.max(1, Math.floor(position / PAGE_SIZE) + 1)
}

export function usePlayer(playlistId: Ref<string>) {
  const currentVideo = ref<any>(null)
  const currentPosition = ref(-1)
  const videos = ref<any[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const windowStartPage = ref(1)
  const hasNextPage = ref(true)

  const hasPrevPage = computed(() => windowStartPage.value > 1)
  const windowEndPage = computed(() => windowStartPage.value + WINDOW_PAGES - 1)

  function inWindow(pos: number) {
    return videos.value.some(v => v.item?.position === pos)
  }

  async function fetchPage(page: number) {
    return $fetch<any[]>(`/api/playlists/${playlistId.value}/videos`, {
      query: { page, limit: PAGE_SIZE },
    })
  }

  async function loadWindow(centerPosition: number) {
    const startPage = Math.max(1, posToPage(centerPosition) - 1)
    const pages = await Promise.all(
      Array.from({ length: WINDOW_PAGES }, (_, i) => fetchPage(startPage + i)),
    )
    videos.value = pages.flat()
    windowStartPage.value = startPage
    hasNextPage.value = pages[WINDOW_PAGES - 1].length === PAGE_SIZE
  }

  async function loadVideos() {
    loading.value = true
    try {
      await loadWindow(0)
    }
    finally {
      loading.value = false
    }
  }

  // Returns added row count so caller can compensate scroll position.
  async function loadNextPage(): Promise<number> {
    if (!hasNextPage.value || loadingMore.value) return 0
    loadingMore.value = true
    try {
      const rows = await fetchPage(windowEndPage.value + 1)
      if (!rows.length) { hasNextPage.value = false; return 0 }
      videos.value = [...videos.value.slice(PAGE_SIZE), ...rows]
      windowStartPage.value++
      hasNextPage.value = rows.length === PAGE_SIZE
      return rows.length
    }
    finally {
      loadingMore.value = false
    }
  }

  // Returns added row count for scroll compensation.
  async function loadPrevPage(): Promise<number> {
    if (!hasPrevPage.value || loadingMore.value) return 0
    loadingMore.value = true
    try {
      const rows = await fetchPage(windowStartPage.value - 1)
      if (!rows.length) return 0
      videos.value = [...rows, ...videos.value.slice(0, -PAGE_SIZE)]
      windowStartPage.value--
      return rows.length
    }
    finally {
      loadingMore.value = false
    }
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
      if (!inWindow(result.item?.position ?? -1)) {
        loadingMore.value = true
        try {
          await loadWindow(result.item?.position ?? 0)
        }
        finally {
          loadingMore.value = false
        }
      }
      play(result)
    }
    catch {
      // reached the end of the playlist
    }
  }

  async function seekToVideo(videoId: string) {
    const inLoaded = videos.value.find(v => v.video?.id === videoId)
    if (inLoaded) { play(inLoaded); return }
    // Video not in current window — look it up to get its position, then re-window
    const result = await $fetch<any>(`/api/playlists/${playlistId.value}/videos/find`, {
      query: { videoId },
    })
    loadingMore.value = true
    try {
      await loadWindow(result.item?.position ?? 0)
    }
    finally {
      loadingMore.value = false
    }
    play(result)
  }

  async function next() { await navigateAdjacent('next') }
  async function previous() { await navigateAdjacent('prev') }

  async function random() {
    const result = await $fetch<any>(`/api/playlists/${playlistId.value}/videos/random`)
    loadingMore.value = true
    try {
      await loadWindow(result.item?.position ?? 0)
    }
    finally {
      loadingMore.value = false
    }
    play(result)
  }

  return {
    currentVideo,
    currentPosition,
    videos,
    loading,
    loadingMore,
    hasPrevPage,
    hasNextPage,
    loadVideos,
    loadNextPage,
    loadPrevPage,
    seekToVideo,
    play,
    next,
    previous,
    random,
  }
}
