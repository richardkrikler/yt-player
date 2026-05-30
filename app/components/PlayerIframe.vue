<script setup lang="ts">
import type { AutoPlayMode } from '~/composables/usePlayerSettings'

const props = defineProps<{
  videoId: string
  title?: string | null
  channelTitle?: string | null
  channelId?: string | null
  publishedAt?: number | null
  autoPlay: boolean
  autoPlayMode: AutoPlayMode
}>()

const publishedDate = computed(() => {
  if (!props.publishedAt) return null
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(props.publishedAt))
})

const emit = defineEmits<{
  previous: []
  next: []
  random: []
  similar: []
  'update:autoPlay': [value: boolean]
  'update:autoPlayMode': [value: AutoPlayMode]
}>()

const modes: { value: AutoPlayMode; label: string }[] = [
  { value: 'next', label: 'Next' },
  { value: 'random', label: 'Random' },
  { value: 'similar', label: 'Similar' },
]

const playerEl = ref<HTMLElement | null>(null)
let player: any = null

// YouTube IFrame API error codes:
//   101 / 150 → age-restricted or embed disabled → show "Watch on YouTube"
//   5         → restricted by network/workspace admin
//   100       → video deleted or set to private
type BlockReason = 'age' | 'unavailable' | null
const blockReason = ref<BlockReason>(null)

// ── Auto-skip countdown ───────────────────────────────────────────────
const SKIP_MS = 5000
const secondsLeft = ref(0)
const skipCancelled = ref(false)
const skipBarEl = ref<HTMLElement | null>(null)
let skipTimeout: ReturnType<typeof setTimeout> | null = null
let skipInterval: ReturnType<typeof setInterval> | null = null

function clearSkipTimer() {
  if (skipTimeout !== null) { clearTimeout(skipTimeout); skipTimeout = null }
  if (skipInterval !== null) { clearInterval(skipInterval); skipInterval = null }
  secondsLeft.value = 0
  if (skipBarEl.value) {
    skipBarEl.value.style.transition = 'none'
    skipBarEl.value.style.width = '0%'
  }
}

function cancelSkip() {
  clearSkipTimer()
  skipCancelled.value = true
}

function startSkipTimer() {
  clearSkipTimer()
  skipCancelled.value = false
  if (!props.autoPlay) return
  secondsLeft.value = Math.round(SKIP_MS / 1000)
  // Let the DOM render the bar at 0% before starting the CSS transition
  nextTick(() => {
    if (!skipBarEl.value) return
    skipBarEl.value.style.transition = 'none'
    skipBarEl.value.style.width = '0%'
    void skipBarEl.value.offsetWidth // force reflow so the reset is painted first
    skipBarEl.value.style.transition = `width ${SKIP_MS}ms linear`
    skipBarEl.value.style.width = '100%'
  })
  // Countdown text (1 s ticks)
  skipInterval = setInterval(() => { secondsLeft.value = Math.max(0, secondsLeft.value - 1) }, 1000)
  // Actual skip
  skipTimeout = setTimeout(() => { clearSkipTimer(); onEnded() }, SKIP_MS)
}

watch(blockReason, (reason) => {
  skipCancelled.value = false
  if (reason && props.autoPlay) startSkipTimer()
  else clearSkipTimer()
})

watch(() => props.autoPlay, (on) => {
  if (on && blockReason.value) startSkipTimer()
  else clearSkipTimer()
})

function onEnded() {
  if (!props.autoPlay) return
  if (props.autoPlayMode === 'random') emit('random')
  else if (props.autoPlayMode === 'similar') emit('similar')
  else emit('next')
}

function createPlayer() {
  if (!playerEl.value) return
  blockReason.value = null
  player = new (window as any).YT.Player(playerEl.value, {
    videoId: props.videoId,
    playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
    events: {
      onStateChange: (e: any) => { if (e.data === 0) onEnded() },
      onError: (e: any) => {
        if (e.data === 101 || e.data === 150) blockReason.value = 'age'
        else blockReason.value = 'unavailable' // 2, 5, 100, or any future code
      },
    },
  })
}

function loadYTApi(): Promise<void> {
  if ((window as any).YT?.Player) return Promise.resolve()
  return new Promise(resolve => {
    const existing = (window as any).onYouTubeIframeAPIReady
    ;(window as any).onYouTubeIframeAPIReady = () => { existing?.(); resolve() }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  })
}

onMounted(async () => {
  await loadYTApi()
  createPlayer()
})

onUnmounted(() => { player?.destroy(); clearSkipTimer() })

defineExpose({
  playPause: () => {
    if (!player) return
    player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo()
  },
  seekBack: (s = 10) => player?.seekTo(Math.max(0, player.getCurrentTime() - s), true),
  seekForward: (s = 10) => player?.seekTo(player.getCurrentTime() + s, true),
})

watch(() => props.videoId, (id) => {
  blockReason.value = null // triggers clearSkipTimer via the blockReason watcher
  if (player?.loadVideoById) player.loadVideoById(id)
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="aspect-video w-full rounded-xl overflow-hidden bg-black relative">
      <div ref="playerEl" class="w-full h-full" />
      <!-- Playback error fallback — single root so <Transition> works correctly -->
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
      >
        <div
          v-if="blockReason"
          class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-900/95 text-center px-6"
        >
          <template v-if="blockReason === 'age'">
            <UIcon name="i-heroicons-lock-closed" class="size-10 text-gray-400" aria-hidden="true" />
            <div>
              <p class="text-sm font-medium text-gray-200">Age-restricted video</p>
              <p class="text-xs text-gray-400 mt-1">This video can't be played in an embedded player.</p>
            </div>
            <UButton
              :to="`https://www.youtube.com/watch?v=${videoId}&rco=1`"
              target="_blank"
              rel="noopener noreferrer"
              icon="i-simple-icons-youtube"
              color="error"
              size="sm"
            >
              Watch on YouTube
            </UButton>
          </template>

          <template v-else>
            <UIcon name="i-heroicons-exclamation-circle" class="size-10 text-gray-500" aria-hidden="true" />
            <div>
              <p class="text-sm font-medium text-gray-200">Video unavailable</p>
              <p class="text-xs text-gray-400 mt-1">This video may have been removed, set to private, or restricted by your network.</p>
            </div>
          </template>

          <!-- Auto-skip countdown — shown for both error types when auto-play is on -->
          <div v-if="autoPlay && !skipCancelled" class="w-full max-w-xs">
            <div class="flex items-center justify-between mb-2">
              <p class="text-xs text-gray-500">Playing next in {{ secondsLeft }}s…</p>
              <button
                type="button"
                class="text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Cancel auto-skip"
                @click="cancelSkip"
              >
                <UIcon name="i-heroicons-x-mark" class="size-4" aria-hidden="true" />
              </button>
            </div>
            <div class="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
              <div ref="skipBarEl" class="h-full bg-gray-400 rounded-full" style="width:0%" />
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 v-if="title" class="font-semibold text-base leading-snug line-clamp-2">
          <a
            :href="`https://www.youtube.com/watch?v=${videoId}`"
            target="_blank"
            rel="noopener noreferrer"
            class="group inline-flex items-center gap-1 hover:underline"
          >{{ title }}<UIcon name="i-heroicons-arrow-top-right-on-square" class="size-3 shrink-0 opacity-0 group-hover:opacity-100" aria-hidden="true" /></a>
        </h2>
        <p v-if="channelTitle || publishedDate" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
          <template v-if="channelTitle">
            <a
              v-if="channelId"
              :href="`https://www.youtube.com/channel/${channelId}`"
              target="_blank"
              rel="noopener noreferrer"
              class="group inline-flex items-center hover:underline"
            >{{ channelTitle }}<UIcon name="i-heroicons-arrow-top-right-on-square" class="size-3 w-0 overflow-hidden group-hover:w-3 group-hover:ml-1 transition-[width,margin] duration-150" aria-hidden="true" /></a>
            <template v-else>{{ channelTitle }}</template>
          </template>
          <span v-if="publishedDate" class="text-gray-500 dark:text-gray-400">{{ publishedDate }}</span>
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <!-- Manual controls -->
      <UButton variant="ghost" icon="i-heroicons-backward" aria-label="Previous video" @click="$emit('previous')" />
      <UButton variant="ghost" icon="i-heroicons-arrow-path" aria-label="Random video" @click="$emit('random')">
        Random
      </UButton>
      <UButton variant="ghost" icon="i-heroicons-forward" aria-label="Next video" @click="$emit('next')" />

      <!-- Auto-play controls -->
      <div class="ml-auto flex items-center gap-3 flex-wrap justify-end">
        <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
          <USwitch
            :model-value="autoPlay"
            @update:model-value="$emit('update:autoPlay', $event)"
          />
          <span>Auto-play</span>
        </label>

        <!-- 3-way mode selector — only visible when auto-play is on -->
        <Transition
          enter-active-class="transition-all duration-150 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-100 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="autoPlay"
            class="flex gap-1"
            role="group"
            aria-label="Auto-play mode"
          >
            <button
              v-for="m in modes"
              :key="m.value"
              type="button"
              class="px-2.5 py-1 text-xs rounded-full border transition-colors"
              :class="autoPlayMode === m.value
                ? 'bg-primary-500 dark:bg-primary-400 text-white dark:text-gray-900 border-primary-500 dark:border-primary-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400'"
              :aria-pressed="autoPlayMode === m.value"
              @click="$emit('update:autoPlayMode', m.value)"
            >
              {{ m.label }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
