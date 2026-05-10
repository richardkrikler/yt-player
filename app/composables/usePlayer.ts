export function usePlayer(playlistId: Ref<string>) {
  const currentVideo = ref<any>(null)
  const videos = ref<any[]>([])
  const currentIndex = ref(-1)
  const loading = ref(false)

  async function loadVideos() {
    loading.value = true
    try {
      const rows = await $fetch<any[]>(`/api/playlists/${playlistId.value}/videos`, {
        query: { limit: 500 },
      })
      videos.value = rows
    }
    finally {
      loading.value = false
    }
  }

  function play(video: any) {
    currentVideo.value = video
    currentIndex.value = videos.value.findIndex(v => v.video.id === (video.video?.id ?? video.id))
  }

  function next() {
    if (currentIndex.value < videos.value.length - 1) {
      play(videos.value[currentIndex.value + 1])
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
    loadVideos,
    play,
    next,
    previous,
    random,
  }
}
