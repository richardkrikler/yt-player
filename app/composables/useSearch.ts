export function useSearch(playlistId?: Ref<string | undefined>) {
  const query = ref('')
  const results = ref<any[]>([])
  const loading = ref(false)
  let debounceTimer: ReturnType<typeof setTimeout>

  async function search() {
    const q = query.value.trim()
    if (q.length < 2) {
      results.value = []
      return
    }

    loading.value = true
    try {
      const data = await $fetch<{ results: any[] }>('/api/search', {
        query: {
          q,
          ...(playlistId?.value ? { playlist: playlistId.value } : {}),
        },
      })
      results.value = data.results
    }
    catch {
      results.value = []
    }
    finally {
      loading.value = false
    }
  }

  function onQueryChange() {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(search, 300)
  }

  watch(query, onQueryChange)

  function clear() {
    query.value = ''
    results.value = []
  }

  return { query, results, loading, clear }
}
