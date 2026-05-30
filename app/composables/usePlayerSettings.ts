export type AutoPlayMode = 'next' | 'random' | 'similar'

const HISTORY_MAX = 10

export interface PlayHistoryEntry { id: string, playedAt: number }

export function usePlayerSettings(userId: Ref<number | undefined>, playlistId: Ref<string>) {
  const autoPlay = ref(false)
  const autoPlayMode = ref<AutoPlayMode>('next')
  const similarCrossPlaylist = ref(true)

  function key() {
    return `player-settings:${userId.value}:${playlistId.value}`
  }

  function load() {
    if (!import.meta.client || !userId.value || !playlistId.value) return
    try {
      const raw = localStorage.getItem(key())
      if (raw) {
        const s = JSON.parse(raw)
        autoPlay.value = s.autoPlay ?? false
        // backward-compat: migrate legacy randomNext boolean
        autoPlayMode.value = s.autoPlayMode ?? (s.randomNext ? 'random' : 'next')
        similarCrossPlaylist.value = s.similarCrossPlaylist ?? true
      } else {
        autoPlay.value = false
        autoPlayMode.value = 'next'
        similarCrossPlaylist.value = true
      }
    } catch {}
  }

  function save() {
    if (!import.meta.client || !userId.value || !playlistId.value) return
    try {
      localStorage.setItem(key(), JSON.stringify({
        autoPlay: autoPlay.value,
        autoPlayMode: autoPlayMode.value,
        similarCrossPlaylist: similarCrossPlaylist.value,
      }))
    } catch {}
  }

  function historyKey() {
    return `player-history:${userId.value}`
  }

  function getHistory(): PlayHistoryEntry[] {
    if (!import.meta.client || !userId.value) return []
    try {
      const raw = localStorage.getItem(historyKey())
      return raw ? JSON.parse(raw) : []
    }
    catch { return [] }
  }

  function pushHistory(id: string) {
    if (!import.meta.client || !userId.value) return
    try {
      const history = getHistory().filter(h => h.id !== id)
      history.push({ id, playedAt: Date.now() })
      if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX)
      localStorage.setItem(historyKey(), JSON.stringify(history))
    }
    catch {}
  }

  watch([userId, playlistId], load, { immediate: true })
  watch([autoPlay, autoPlayMode, similarCrossPlaylist], save)

  return { autoPlay, autoPlayMode, similarCrossPlaylist, getHistory, pushHistory }
}
