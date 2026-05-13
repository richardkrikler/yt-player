<script setup lang="ts">
defineProps<{
  videos: any[]
  activeVideoId?: string | null
}>()

defineEmits<{ play: [video: any] }>()

function formatDuration(iso: string | null | undefined): string {
  if (!iso) return ''
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''
  const h = Number(match[1] ?? 0)
  const m = Number(match[2] ?? 0)
  const s = Number(match[3] ?? 0)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <ol class="flex flex-col gap-1" aria-label="Video list">
    <li
      v-for="row in videos"
      :key="row.item?.id"
    >
      <button
        class="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors"
        :class="{ 'bg-primary-50 dark:bg-primary-950': activeVideoId === row.video?.id }"
        :aria-current="activeVideoId === row.video?.id ? 'true' : undefined"
        @click="$emit('play', row)"
      >
        <span class="text-xs text-gray-500 dark:text-gray-400 w-6 shrink-0 text-right" aria-hidden="true">
          {{ row.item?.position + 1 }}
        </span>
        <img
          v-if="row.video?.thumbnail_url"
          :src="row.video.thumbnail_url"
          :alt="row.video.title"
          class="w-16 h-12 object-cover rounded shrink-0"
        >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium line-clamp-2 leading-snug">{{ row.video?.title }}</p>
          <p class="text-xs text-gray-500 mt-0.5 truncate">{{ row.video?.channel_title }}</p>
        </div>
        <span v-if="row.video?.duration" class="text-xs text-gray-500 dark:text-gray-400 shrink-0 tabular-nums">
          {{ formatDuration(row.video.duration) }}
        </span>
      </button>
    </li>
  </ol>
</template>
