<script setup lang="ts">
const props = defineProps<{
  videoId: string
  title?: string | null
  channelTitle?: string | null
}>()

defineEmits<{ previous: [], next: [], random: [] }>()

const embedUrl = computed(() =>
  `https://www.youtube.com/embed/${props.videoId}?autoplay=1&rel=0`,
)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="aspect-video w-full rounded-xl overflow-hidden bg-black">
      <iframe
        :key="videoId"
        :src="embedUrl"
        :title="title ?? 'YouTube video'"
        class="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      />
    </div>

    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 v-if="title" class="font-semibold text-base leading-snug line-clamp-2">{{ title }}</h2>
        <p v-if="channelTitle" class="text-sm text-gray-500 mt-0.5">{{ channelTitle }}</p>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <UButton
        variant="ghost"
        icon="i-heroicons-backward"
        aria-label="Previous video"
        @click="$emit('previous')"
      />
      <UButton
        variant="ghost"
        icon="i-heroicons-arrow-path"
        aria-label="Random video"
        @click="$emit('random')"
      >
        Random
      </UButton>
      <UButton
        variant="ghost"
        icon="i-heroicons-forward"
        aria-label="Next video"
        @click="$emit('next')"
      />
    </div>
  </div>
</template>
