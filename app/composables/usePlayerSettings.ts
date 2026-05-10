export function usePlayerSettings(userId: Ref<number | undefined>, playlistId: Ref<string>) {
  const autoPlay = ref(false)
  const randomNext = ref(false)

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
        randomNext.value = s.randomNext ?? false
      } else {
        autoPlay.value = false
        randomNext.value = false
      }
    } catch {}
  }

  function save() {
    if (!import.meta.client || !userId.value || !playlistId.value) return
    try {
      localStorage.setItem(key(), JSON.stringify({ autoPlay: autoPlay.value, randomNext: randomNext.value }))
    } catch {}
  }

  watch([userId, playlistId], load, { immediate: true })
  watch([autoPlay, randomNext], save)

  return { autoPlay, randomNext }
}
