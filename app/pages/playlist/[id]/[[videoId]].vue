<script setup lang="ts">
const route = useRoute()
const playlistId = computed(() => route.params.id as string)
const { query: searchQuery, results: searchResults, loading: searchLoading } = useSearch(playlistId)

const {
  videos, currentVideo, currentPosition,
  loading, loadingMore, hasPrevPage, hasNextPage,
  loadVideos, loadNextPage, loadPrevPage, seekToVideo, play, next, previous, random,
} = usePlayer(playlistId)

const { user } = useUserSession()
const userId = computed(() => user.value?.id)
const { autoPlay, randomNext } = usePlayerSettings(userId, playlistId)

const showShare = ref(false)
const listContainer = ref<HTMLElement | null>(null)
const topSentinel = ref<HTMLElement | null>(null)
const bottomSentinel = ref<HTMLElement | null>(null)

const activeVideo = computed(() => currentVideo.value?.video ?? currentVideo.value)

const { data: playlist } = await useFetch(`/api/playlists/${playlistId.value}`)

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

onMounted(async () => {
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
  <div>
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <NuxtLink to="/" class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        ← Back
      </NuxtLink>
      <h1 class="font-bold text-lg truncate">{{ playlist?.title }}</h1>
      <UBadge v-if="playlist?.privacyStatus === 'private'" color="orange" variant="soft" size="xs">
        Private
      </UBadge>
      <div class="ml-auto flex gap-2">
        <UButton size="sm" variant="ghost" icon="i-heroicons-share" @click="showShare = true">
          Share
        </UButton>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
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
            <p class="text-lg">Select a video to play</p>
            <UButton v-if="videos.length === 0 && !loading" class="mt-3" @click="$fetch(`/api/playlists/${playlistId}/fetch-videos`, { method: 'POST' }).then(loadVideos)">
              Fetch videos
            </UButton>
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

        <div v-else ref="listContainer" class="overflow-y-auto max-h-[calc(100vh-12rem)]">
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
