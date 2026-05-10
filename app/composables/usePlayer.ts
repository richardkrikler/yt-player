const PAGE_SIZE = 50

export function usePlayer(playlistId: Ref<string>) {
  const currentVideo = ref<any>(null)
  const videos = ref<any[]>([])
  const currentIndex = ref(-1)
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasMore = ref(true)
  const currentPage = ref(0)

  async function fetchPage(p: number) {
    const rows = await $fetch<any[]>(`/api/playlists/${playlistId.value}/videos`, {
      query: { page: p, limit: PAGE_SIZE },
    })
    if (p === 1) {
      videos.value = rows
    } else {
      videos.value = [...videos.value, ...rows]
    }
    hasMore.value = rows.length === PAGE_SIZE
    currentPage.value = p
  }

  async function loadVideos() {
    loading.value = true
    try {
      await fetchPage(1)
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (!hasMore.value || loadingMore.value || loading.value) return
    loadingMore.value = true
    try {
      await fetchPage(currentPage.value + 1)
    } finally {
      loadingMore.value = false
    }
  }

  function play(video: any) {
    currentVideo.value = video
    currentIndex.value = videos.value.findIndex(v => v.video.id === (video.video?.id ?? video.id))
  }

  async function next() {
    if (currentIndex.value < videos.value.length - 1) {
      play(videos.value[currentIndex.value + 1])
    } else if (hasMore.value) {
      await loadMore()
      if (currentIndex.value < videos.value.length - 1) {
        play(videos.value[currentIndex.value + 1])
      }
    }
  }

  function previous() {
    if (currentIndex.value > 0) {
      play(videos.value[currentIndex.value - 1])
    }
  }

  async function random() {
    const result = await $fetch(`/api/playlists/${playlistId.value}/videos/random`)
    play(result)
  }

  return {
    currentVideo,
    videos,
    currentIndex,
    loading,
    loadingMore,
    hasMore,
    loadVideos,
    loadMore,
    play,
    next,
    previous,
    random,
  }
}
