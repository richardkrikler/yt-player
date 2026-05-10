<script setup lang="ts">
const route = useRoute()
const playlistId = computed(() => route.params.id as string)
const { query: searchQuery, results: searchResults, loading: searchLoading } = useSearch(playlistId)

const { videos, currentVideo, currentIndex, loading, loadVideos, play, next, previous, random } = usePlayer(playlistId)
const showShare = ref(false)

const activeVideo = computed(() => currentVideo.value?.video ?? currentVideo.value)

const { data: playlist } = await useFetch(`/api/playlists/${playlistId.value}`)

onMounted(async () => {
  await loadVideos()
  // auto-play video from query param if provided
  const videoId = route.query.videoId as string | undefined
  if (videoId) {
    const match = videos.value.find(r => r.video?.id === videoId)
    if (match) play(match)
  }
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
        <div v-if="activeVideo" >
          <PlayerIframe
            :video-id="activeVideo.id"
            :title="activeVideo.title"
            :channel-title="activeVideo.channel_title"
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

        <div v-else class="overflow-y-auto max-h-[calc(100vh-12rem)]">
          <VideoList
            :videos="displayVideos"
            :active-video-id="activeVideo?.id"
            @play="play"
          />
        </div>
      </div>
    </div>

    <ShareModal v-model:open="showShare" :playlist-id="playlistId" />
  </div>
</template>
