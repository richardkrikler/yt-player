<script setup lang="ts">
import type { AutoPlayMode } from '~/composables/usePlayerSettings'

const props = defineProps<{
  videoId: string
  title?: string | null
  channelTitle?: string | null
  autoPlay: boolean
  autoPlayMode: AutoPlayMode
}>()

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

function onEnded() {
  if (!props.autoPlay) return
  if (props.autoPlayMode === 'random') emit('random')
  else if (props.autoPlayMode === 'similar') emit('similar')
  else emit('next')
}

function createPlayer() {
  if (!playerEl.value) return
  player = new (window as any).YT.Player(playerEl.value, {
    videoId: props.videoId,
    playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
    events: {
      onStateChange: (e: any) => { if (e.data === 0) onEnded() },
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

onUnmounted(() => player?.destroy())

watch(() => props.videoId, (id) => {
  if (player?.loadVideoById) player.loadVideoById(id)
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="aspect-video w-full rounded-xl overflow-hidden bg-black">
      <div ref="playerEl" class="w-full h-full" />
    </div>

    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 v-if="title" class="font-semibold text-base leading-snug line-clamp-2">{{ title }}</h2>
        <p v-if="channelTitle" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ channelTitle }}</p>
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
