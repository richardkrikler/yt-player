<script setup lang="ts">
definePageMeta({ viewTransition: { fromTypes: ['vt-back'] } })
const route = useRoute()
const playlistId = computed(() => route.params.id as string)
const { query: searchQuery, results: searchResults, loading: searchLoading } = useSearch(playlistId)

const {
  videos, currentVideo, currentPosition,
  loading, loadingMore, hasPrevPage, hasNextPage,
  loadVideos, loadNextPage, loadPrevPage, seekToVideo, play, next, previous, random,
} = usePlayer(playlistId)

const { fetchVideos } = usePlaylist()
const fetching = ref(false)

async function handleFetchVideos() {
  fetching.value = true
  try {
    await fetchVideos(playlistId.value)
    await loadVideos()
  }
  finally {
    fetching.value = false
  }
}

const { user } = useUserSession()
const userId = computed(() => user.value?.id)
const { autoPlay, randomNext } = usePlayerSettings(userId, playlistId)

const { setPlaylistVTNames, clearPlaylistVTNames, backId: playlistBackId } = usePlaylistTransition()
const h1El = ref<HTMLElement | null>(null)
const thumbEl = ref<HTMLImageElement | null>(null)

const showShare = ref(false)
const listContainer = ref<HTMLElement | null>(null)
const topSentinel = ref<HTMLElement | null>(null)
const bottomSentinel = ref<HTMLElement | null>(null)

const activeVideo = computed(() => currentVideo.value?.video ?? currentVideo.value)

const { data: playlist } = await useFetch(`/api/playlists/${playlistId.value}`)

useHead(computed(() => ({
  title: activeVideo.value?.title
    ? `${activeVideo.value.title} · ${playlist.value?.customTitle || playlist.value?.title || 'Playlist'}`
    : (playlist.value?.customTitle || playlist.value?.title || 'Playlist'),
})))

async function scrollToActive() {
  await nextTick()
  listContainer.value
    ?.querySelector('[aria-current="true"]')
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function handleLoadPrev() {
  const container = listContainer.value
  if (!container || !hasPrevPage.value) return
  const heightBefore = container.scrollHeight
  await loadPrevPage()
  await nextTick()
  container.scrollTop += container.scrollHeight - heightBefore
}

onBeforeRouteLeave((to) => {
  if (to.path === '/') {
    // Signal home page which card is the morph target; keep names for old-state capture
    playlistBackId.value = playlistId.value
  } else {
    // Going elsewhere: remove names so they slide with the root, not float free
    clearPlaylistVTNames()
  }
})

onMounted(async () => {
  // Stamp names synchronously (before first await) so page:finish new-state
  // capture includes them — this is the forward-transition new-state target.
  setPlaylistVTNames(thumbEl.value, h1El.value)

  await loadVideos()

  const initialVideoId = (route.params.videoId as string) || (route.query.videoId as string) || undefined
  if (initialVideoId) {
    await seekToVideo(initialVideoId)
    await scrollToActive()
  }

  await nextTick()
  const container = listContainer.value!

  const topObs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) handleLoadPrev()
  }, { root: container, rootMargin: '150px' })

  const bottomObs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadNextPage()
  }, { root: container, rootMargin: '150px' })

  if (topSentinel.value) topObs.observe(topSentinel.value)
  if (bottomSentinel.value) bottomObs.observe(bottomSentinel.value)

  onUnmounted(() => { topObs.disconnect(); bottomObs.disconnect() })
})

const router = useRouter()

// Sync the URL with the playing video. Because the alias maps to the same
// component, router.replace does not remount — it only updates the route.
watch(currentVideo, async (video) => {
  const vid = video?.video?.id
  await router.replace(
    vid
      ? { path: `/playlist/${playlistId.value}/${vid}` }
      : { path: `/playlist/${playlistId.value}` },
  )
  await scrollToActive()
})

const displayVideos = computed(() =>
  searchQuery.value.length >= 2 ? searchResults.value : videos.value,
)
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center gap-3 mb-4 flex-wrap shrink-0">
      <NuxtLink to="/" class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
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
      <UBadge v-if="playlist?.privacyStatus === 'private'" color="orange" variant="soft" size="xs">
        Private
      </UBadge>
      <div class="ml-auto flex gap-2">
        <UButton size="sm" variant="ghost" icon="i-heroicons-share" @click="showShare = true">
          Share
        </UButton>
      </div>
    </div>

    <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <!-- Player -->
      <div>
        <div v-if="activeVideo">
          <PlayerIframe
            :video-id="activeVideo.id"
            :title="activeVideo.title"
            :channel-title="activeVideo.channel_title"
            v-model:auto-play="autoPlay"
            v-model:random-next="randomNext"
            @previous="previous"
            @next="next"
            @random="random"
          />
        </div>
        <div v-else class="aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-400">
          <div class="text-center">
            <template v-if="fetching">
              <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin mx-auto" />
              <p class="text-sm mt-3">Fetching videos…</p>
            </template>
            <template v-else-if="videos.length > 0">
              <p class="text-lg">Select a video to play</p>
              <UButton class="mt-3" icon="i-heroicons-arrow-path" @click="random">
                Random
              </UButton>
            </template>
            <template v-else-if="!loading">
              <p class="text-lg">No videos cached yet</p>
              <UButton class="mt-3" @click="handleFetchVideos">
                Fetch videos
              </UButton>
            </template>
          </div>
        </div>
      </div>

      <!-- Video list -->
      <div class="flex flex-col gap-3 min-h-0">
        <UInput
          v-model="searchQuery"
          placeholder="Search in playlist…"
          icon="i-heroicons-magnifying-glass"
          :loading="searchLoading"
        />

        <div v-if="loading" class="text-center py-8 text-gray-400">Loading videos…</div>

        <div v-else-if="videos.length === 0" class="text-center py-8 text-gray-400">
          <p>No videos cached yet.</p>
        </div>

        <div v-else ref="listContainer" class="overflow-y-auto flex-1 min-h-0">
          <div ref="topSentinel" class="h-1" />
          <div v-if="loadingMore" class="text-center py-2 text-xs text-gray-400">Loading…</div>
          <VideoList
            :videos="displayVideos"
            :active-video-id="activeVideo?.id"
            @play="play"
          />
          <div ref="bottomSentinel" class="h-1" />
        </div>
      </div>
    </div>

    <ShareModal v-model:open="showShare" :playlist-id="playlistId" />
  </div>
</template>
