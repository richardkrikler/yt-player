export function usePlaylist() {
  // useState persists across client-side navigations so cards are immediately
  // available when the home page re-mounts (needed for back-nav morph timing).
  const playlists = useState<any[]>('playlists', () => [])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const youtubeAuthExpired = useState('youtubeAuthExpired', () => false)
  const { fetch: refreshSession } = useUserSession()

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
    try {
      const updated = await $fetch(`/api/playlists/${id}/refresh`, { method: 'POST' })
      const idx = playlists.value.findIndex(p => p.id === id)
      if (idx !== -1) playlists.value[idx] = updated
      return updated
    }
    catch (e: any) {
      if (e?.status === 401) {
        youtubeAuthExpired.value = true
        await refreshSession()
      }
      throw e
    }
  }

  async function fetchVideos(id: string) {
    try {
      return await $fetch(`/api/playlists/${id}/fetch-videos`, { method: 'POST' })
    }
    catch (e: any) {
      if (e?.status === 401) {
        youtubeAuthExpired.value = true
        await refreshSession()
      }
      throw e
    }
  }

  async function renamePlaylist(id: string, title: string) {
    const { customTitle } = await $fetch<{ customTitle: string | null }>(
      `/api/playlists/${id}/custom-title`,
      { method: 'PATCH', body: { title } },
    )
    const idx = playlists.value.findIndex(p => p.id === id)
    if (idx !== -1) playlists.value[idx] = { ...playlists.value[idx], customTitle }
  }

  return {
    playlists,
    loading,
    error,
    youtubeAuthExpired,
    fetchPlaylists,
    importFromYouTube,
    importFromUrl,
    removePlaylist,
    refreshMetadata,
    fetchVideos,
    renamePlaylist,
  }
}
