export function usePlaylist() {
  const playlists = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchPlaylists() {
    loading.value = true
    error.value = null
    try {
      playlists.value = await $fetch('/api/playlists')
    }
    catch (e: any) {
      error.value = e?.data?.message ?? 'Failed to load playlists'
    }
    finally {
      loading.value = false
    }
  }

  async function importFromYouTube(ids: string[]) {
    return $fetch('/api/playlists/import', { method: 'POST', body: { ids } })
  }

  async function importFromUrl(url: string) {
    return $fetch('/api/playlists/import-url', { method: 'POST', body: { url } })
  }

  async function removePlaylist(id: string) {
    await $fetch(`/api/playlists/${id}`, { method: 'DELETE' })
    playlists.value = playlists.value.filter(p => p.id !== id)
  }

  async function refreshMetadata(id: string) {
    const updated = await $fetch(`/api/playlists/${id}/refresh`, { method: 'POST' })
    const idx = playlists.value.findIndex(p => p.id === id)
    if (idx !== -1) playlists.value[idx] = updated
    return updated
  }

  async function fetchVideos(id: string) {
    return $fetch(`/api/playlists/${id}/fetch-videos`, { method: 'POST' })
  }

  return {
    playlists,
    loading,
    error,
    fetchPlaylists,
    importFromYouTube,
    importFromUrl,
    removePlaylist,
    refreshMetadata,
    fetchVideos,
  }
}
