<script setup lang="ts">
const props = defineProps<{
  videoId: string
  title?: string | null
  channelTitle?: string | null
  autoPlay: boolean
  randomNext: boolean
}>()

const emit = defineEmits<{
  previous: []
  next: []
  random: []
  'update:autoPlay': [value: boolean]
  'update:randomNext': [value: boolean]
}>()

const playerEl = ref<HTMLElement | null>(null)
let player: any = null

function onEnded() {
  if (!props.autoPlay) return
  if (props.randomNext) emit('random')
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
        <p v-if="channelTitle" class="text-sm text-gray-500 mt-0.5">{{ channelTitle }}</p>
      </div>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <UButton variant="ghost" icon="i-heroicons-backward" aria-label="Previous video" @click="$emit('previous')" />
      <UButton variant="ghost" icon="i-heroicons-arrow-path" aria-label="Random video" @click="$emit('random')">
        Random
      </UButton>
      <UButton variant="ghost" icon="i-heroicons-forward" aria-label="Next video" @click="$emit('next')" />

      <div class="ml-auto flex items-center gap-4">
        <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
          <USwitch
            :model-value="autoPlay"
            @update:model-value="$emit('update:autoPlay', $event)"
          />
          <span>Auto-play</span>
        </label>
        <label
          class="flex items-center gap-2 text-sm cursor-pointer select-none"
          :class="{ 'opacity-40 pointer-events-none': !autoPlay }"
        >
          <USwitch
            :model-value="randomNext"
            :disabled="!autoPlay"
            @update:model-value="$emit('update:randomNext', $event)"
          />
          <span>Random next</span>
        </label>
      </div>
    </div>
  </div>
</template>
