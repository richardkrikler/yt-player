<script setup lang="ts">
definePageMeta({ viewTransition: { fromTypes: ['vt-back'] } })
const route = useRoute()
const router = useRouter()
const playlistId = computed(() => route.params.id as string)
const { query: searchQuery, results: searchResults, loading: searchLoading } = useSearch(playlistId)

const {
  videos, currentVideo, currentPosition,
  loading, total,
  loadVideos, goToPage, seekToVideo, play, next, previous, random,
} = usePlayer(playlistId)

const { fetchVideos, youtubeAuthExpired } = usePlaylist()
const fetching = ref(false)

async function handleFetchVideos() {
  fetching.value = true
  try {
    await fetchVideos(playlistId.value)
    await loadVideos()
  }
  catch {
    // youtubeAuthExpired is set by the composable; other errors are silent
  }
  finally {
    fetching.value = false
  }
}

const { user } = useUserSession()
const userId = computed(() => user.value?.id)
const { autoPlay, autoPlayMode, similarCrossPlaylist, getHistory, pushHistory } = usePlayerSettings(userId, playlistId)

// ── "More like this" ─────────────────────────────────────────────────
const showSimilar = ref(false)
const similarVideos = ref<any[]>([])
const similarLoading = ref(false)
const similarError = ref('')

async function loadSimilar() {
  if (!activeVideo.value) return
  similarLoading.value = true
  similarError.value = ''
  try {
    similarVideos.value = await $fetch<any[]>(`/api/videos/${activeVideo.value.id}/similar`, {
      query: {
        crossPlaylist: similarCrossPlaylist.value ? 'true' : 'false',
        playlistId: playlistId.value,
        limit: 6,
      },
    })
  }
  catch {
    similarError.value = 'Could not load suggestions.'
    similarVideos.value = []
  }
  finally {
    similarLoading.value = false
  }
}

async function toggleSimilar() {
  showSimilar.value = !showSimilar.value
  if (showSimilar.value && similarVideos.value.length === 0 && !similarLoading.value) await loadSimilar()
}

watch(similarCrossPlaylist, () => {
  if (showSimilar.value) loadSimilar()
})

async function playNextSimilar() {
  if (!activeVideo.value) return
  try {
    const results = await $fetch<any[]>(`/api/videos/${activeVideo.value.id}/similar`, {
      query: {
        crossPlaylist: similarCrossPlaylist.value ? 'true' : 'false',
        playlistId: playlistId.value,
        limit: 6,
      },
    })
    if (results.length === 0) { next(); return }

    const history = getHistory()
    const historyIds = new Set(history.map(h => h.id))
    const fresh = results.filter(r => !historyIds.has(r.video?.id ?? r.item?.videoId))

    let pick: any
    if (fresh.length > 0) {
      pick = fresh[Math.floor(Math.random() * fresh.length)]
    }
    else {
      // All suggestions recently played — pick the least recently played
      pick = results.reduce((oldest, r) => {
        const tR = history.find(h => h.id === (r.video?.id ?? r.item?.videoId))?.playedAt ?? 0
        const tO = history.find(h => h.id === (oldest.video?.id ?? oldest.item?.videoId))?.playedAt ?? 0
        return tR < tO ? r : oldest
      })
    }

    const videoId = pick.video?.id ?? pick.item?.videoId
    const pid = pick.item?.playlistId ?? playlistId.value
    if (pid !== playlistId.value) {
      await router.push(`/playlist/${pid}/${videoId}`)
    }
    else {
      await seekToVideo(videoId)
    }
  }
  catch {
    next()
  }
}

// ── Layout ───────────────────────────────────────────────────────────
const { setPlaylistVTNames, clearPlaylistVTNames, backId: playlistBackId } = usePlaylistTransition()
const h1El = ref<HTMLElement | null>(null)
const thumbEl = ref<HTMLImageElement | null>(null)
const showShare = ref(false)
const listEl = ref<HTMLElement | null>(null)

const activeVideo = computed(() => currentVideo.value?.video ?? currentVideo.value)

// Record history + re-fetch similar when video changes
watch(activeVideo, (newVideo, oldVideo) => {
  if (oldVideo?.id) pushHistory(oldVideo.id)
  if (showSimilar.value) loadSimilar()
})

const { data: playlist } = await useFetch(`/api/playlists/${playlistId.value}`)

useHead(computed(() => ({
  title: activeVideo.value?.title
    ? `${activeVideo.value.title} · ${playlist.value?.customTitle || playlist.value?.title || 'Playlist'}`
    : (playlist.value?.customTitle || playlist.value?.title || 'Playlist'),
})))

async function scrollToActive() {
  await nextTick()
  listEl.value
    ?.querySelector('[aria-current="true"]')
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

onBeforeRouteLeave((to) => {
  if (to.path === '/') {
    playlistBackId.value = playlistId.value
  }
  else {
    clearPlaylistVTNames()
  }
})

onMounted(async () => {
  setPlaylistVTNames(thumbEl.value, h1El.value)
  await loadVideos()
  const initialVideoId = (route.params.videoId as string) || (route.query.videoId as string) || undefined
  if (initialVideoId) {
    const targetPage = await seekToVideo(initialVideoId)
    // Sync localPage without triggering the watcher (page was already fetched by seekToVideo)
    pausePageWatch = true
    localPage.value = targetPage
    await nextTick()
    pausePageWatch = false
    await scrollToActive()
  }
  // From here on, video changes push new entries into browser history
  initialMounted = true
})

// ── Browser history sync ─────────────────────────────────────────────
// routeChangeFromPlayer: WE pushed the route → ignore the resulting
//   route.params watcher tick so we don't double-seek.
// suppressHistoryPush: route changed from OUTSIDE (back/forward) →
//   skip the push in the currentVideo watcher.
let routeChangeFromPlayer = false
let suppressHistoryPush = false
let initialMounted = false

// Sync playing video → URL (push after first mount, replace during init)
watch(currentVideo, async (video) => {
  const vid = video?.video?.id
  if (suppressHistoryPush) {
    suppressHistoryPush = false
    await scrollToActive()
    return
  }
  routeChangeFromPlayer = true
  const navigate = initialMounted ? router.push.bind(router) : router.replace.bind(router)
  await navigate(
    vid
      ? { path: `/playlist/${playlistId.value}/${vid}` }
      : { path: `/playlist/${playlistId.value}` },
  )
  await scrollToActive()
})

// Sync URL → seek (browser back / forward / direct link after mount)
watch(() => route.params.videoId as string | undefined, async (newVideoId) => {
  if (routeChangeFromPlayer) { routeChangeFromPlayer = false; return }
  if (!initialMounted) return
  if (!newVideoId || newVideoId === activeVideo.value?.id) return
  suppressHistoryPush = true
  const targetPage = await seekToVideo(newVideoId)
  pausePageWatch = true
  localPage.value = targetPage
  await nextTick()
  pausePageWatch = false
  await scrollToActive()
})

const displayVideos = computed(() =>
  searchQuery.value.length >= 2 ? searchResults.value : videos.value,
)

// ── Mobile tabs ──────────────────────────────────────────────────────
const mobileTab = ref<'player' | 'queue'>('player')

function switchToPlayer() {
  mobileTab.value = 'player'
}

async function switchToQueue() {
  mobileTab.value = 'queue'
  await nextTick()
  await scrollToActive()
}

// Switch to player tab when video changes on mobile
watch(activeVideo, () => {
  if (import.meta.client && window.innerWidth < 1024) mobileTab.value = 'player'
})

// ── Pagination ───────────────────────────────────────────────────────
// Use a local page ref so v-model:page works correctly with UPagination.
// Guard prevents the watcher from re-fetching when seekToVideo already
// loaded the right page and we're just syncing the ref.
const localPage = ref(1)
let pausePageWatch = false

watch(localPage, async (p) => {
  if (pausePageWatch) return
  await goToPage(p)
  await nextTick()
  listEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
})
</script>

<template>
  <div class="flex flex-col lg:h-full -mt-6 -mb-6 lg:mt-0 lg:mb-0">
    <!-- Sticky header: playlist info + mobile tabs + mobile search -->
    <div class="sticky top-16 z-10 -mx-4 px-4 bg-gray-50 dark:bg-gray-950 lg:static lg:bg-transparent lg:mx-0 lg:px-0 shrink-0">
      <!-- Playlist info row -->
      <div class="flex items-center gap-3 py-3 flex-wrap">
        <NuxtLink to="/" class="text-sm text-gray-500 dark:text-gray-400">
          ← Back
        </NuxtLink>
        <img
          v-if="playlist?.thumbnailUrl"
          ref="thumbEl"
          :src="playlist.thumbnailUrl"
          :alt="playlist?.customTitle || playlist?.title"
          class="w-14 rounded object-cover shrink-0"
          style="aspect-ratio: 16/9"
        >
        <div class="min-w-0">
          <h1 ref="h1El" class="font-bold text-lg truncate">{{ playlist?.customTitle || playlist?.title }}</h1>
          <p v-if="playlist?.customTitle" class="text-xs text-gray-400 truncate -mt-0.5">{{ playlist?.title }}</p>
        </div>
        <UBadge v-if="playlist?.privacyStatus === 'private'" color="orange" variant="soft" size="sm">
          Private
        </UBadge>
        <div class="ml-auto flex gap-2">
          <UButton
            size="sm"
            variant="ghost"
            icon="i-heroicons-arrow-top-right-on-square"
            :to="`https://www.youtube.com/playlist?list=${playlistId}`"
            target="_blank"
            rel="noopener noreferrer"
          >
            YouTube
          </UButton>
          <UButton size="sm" variant="ghost" icon="i-heroicons-share" @click="showShare = true">
            Share
          </UButton>
        </div>
      </div>

      <!-- Mobile tab bar -->
      <div class="flex lg:hidden border-t border-b border-gray-200 dark:border-gray-700">
        <button
          v-for="tab in [{ id: 'player', label: 'Player' }, { id: 'queue', label: 'Queue' }]"
          :key="tab.id"
          type="button"
          class="flex-1 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="mobileTab === tab.id
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400'"
          @click="tab.id === 'queue' ? switchToQueue() : switchToPlayer()"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Mobile search (queue tab only) -->
      <div v-show="mobileTab === 'queue'" class="py-3 lg:hidden">
        <UInput
          v-model="searchQuery"
          placeholder="Search in playlist…"
          icon="i-heroicons-magnifying-glass"
          :loading="searchLoading"
        />
      </div>
    </div>

    <UAlert
      v-if="youtubeAuthExpired"
      title="YouTube authorization expired"
      description="Your YouTube connection has expired. Reconnect to resume refreshing this playlist."
      color="error"
      variant="outline"
      orientation="horizontal"
      class="mb-4"
      :actions="[{ label: 'Reconnect YouTube', to: '/settings', icon: 'i-simple-icons-youtube' }]"
    />

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:flex-1 lg:min-h-0 mt-4 lg:mt-0">
      <!-- Player column -->
      <div :class="{ 'hidden lg:block': mobileTab !== 'player' }">
        <div v-if="activeVideo">
          <PlayerIframe
            :video-id="activeVideo.id"
            :title="activeVideo.title"
            :channel-title="activeVideo.channelTitle"
            :channel-id="activeVideo.channelId"
            v-model:auto-play="autoPlay"
            v-model:auto-play-mode="autoPlayMode"
            @previous="previous"
            @next="next"
            @random="random"
            @similar="playNextSimilar"
          />

          <!-- More like this -->
          <div class="mt-3">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                @click="toggleSimilar"
              >
                <UIcon
                  :name="showSimilar ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                  class="size-4 transition-transform"
                />
                More like this
              </button>

              <Transition
                enter-active-class="transition-all duration-150 ease-out"
                enter-from-class="opacity-0 scale-95"
                enter-to-class="opacity-100 scale-100"
                leave-active-class="transition-all duration-100 ease-in"
                leave-from-class="opacity-100 scale-100"
                leave-to-class="opacity-0 scale-95"
              >
                <label
                  v-if="showSimilar"
                  class="ml-auto flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none"
                >
                  <USwitch
                    :model-value="similarCrossPlaylist"
                    @update:model-value="similarCrossPlaylist = $event"
                  />
                  <span>All playlists</span>
                </label>
              </Transition>
            </div>

            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition-all duration-150 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div v-if="showSimilar" class="mt-2">
                <div v-if="similarLoading" class="flex items-center gap-2 py-4 text-sm text-gray-400">
                  <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
                  Finding similar videos…
                </div>
                <p v-else-if="similarError" class="text-sm text-red-500 py-2">{{ similarError }}</p>
                <p v-else-if="similarVideos.length === 0" class="text-sm text-gray-400 py-2">No similar videos found.</p>
                <ul v-else class="flex flex-col gap-1">
                  <li v-for="r in similarVideos" :key="r.video.id">
                    <button
                      type="button"
                      class="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                      @click="r.item?.playlistId && r.item.playlistId !== playlistId
                        ? router.push(`/playlist/${r.item.playlistId}/${r.video.id}`)
                        : seekToVideo(r.video.id)"
                    >
                      <img
                        v-if="r.video.thumbnailUrl"
                        :src="r.video.thumbnailUrl"
                        :alt="r.video.title"
                        class="w-20 rounded shrink-0 object-cover"
                        style="aspect-ratio:16/9"
                      >
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium leading-snug line-clamp-2">{{ r.video.title }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ r.video.channelTitle }}</p>
                        <UBadge
                          v-if="r.item?.playlistId && r.item.playlistId !== playlistId"
                          size="xs" variant="soft" color="primary" class="mt-1"
                        >
                          {{ r.customTitle || r.playlist?.title || 'Other playlist' }}
                        </UBadge>
                      </div>
                    </button>
                  </li>
                </ul>
              </div>
            </Transition>
          </div>
        </div>

        <div v-else class="aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-400">
          <div class="text-center">
            <template v-if="fetching">
              <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin mx-auto" />
              <p class="text-sm mt-3">Fetching videos…</p>
            </template>
            <template v-else-if="videos.length > 0">
              <p class="text-lg">Select a video to play</p>
              <UButton class="mt-3" icon="i-heroicons-arrow-path" @click="random">Random</UButton>
            </template>
            <template v-else-if="!loading">
              <p class="text-lg">No videos cached yet</p>
              <UButton class="mt-3" @click="handleFetchVideos">Fetch videos</UButton>
            </template>
          </div>
        </div>
      </div>

      <!-- Queue column -->
      <div
        class="flex flex-col gap-3 lg:min-h-0"
        :class="{ 'hidden lg:flex': mobileTab !== 'queue' }"
      >
        <!-- Desktop search -->
        <UInput
          class="hidden lg:block shrink-0"
          v-model="searchQuery"
          placeholder="Search in playlist…"
          icon="i-heroicons-magnifying-glass"
          :loading="searchLoading"
        />

        <div v-if="loading" class="text-center py-8 text-gray-400">Loading…</div>

        <div v-else-if="videos.length === 0" class="text-center py-8 text-gray-400">
          No videos cached yet.
        </div>

        <div v-else ref="listEl" class="overflow-y-auto flex-1 min-h-[50svh] lg:min-h-0">
          <VideoList
            :videos="displayVideos"
            :active-video-id="activeVideo?.id"
            @play="play"
          />
        </div>

        <!-- Pagination: outside the v-else so it stays visible during page fetches -->
        <div
          v-if="total > 50 && searchQuery.length < 2"
          class="sticky bottom-0 shrink-0 flex justify-center py-2 bg-gray-50 dark:bg-gray-950"
        >
          <UPagination
            v-model:page="localPage"
            :total="total"
            :items-per-page="50"
          />
        </div>
      </div>
    </div>

    <ShareModal v-model:open="showShare" :playlist-id="playlistId" />
  </div>
</template>
