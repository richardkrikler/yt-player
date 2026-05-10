<script setup lang="ts">
defineProps<{
  playlist: {
    id: string
    title: string
    description?: string | null
    channelTitle?: string | null
    itemCount?: number | null
    privacyStatus?: string | null
    thumbnailUrl?: string | null
    videosCachedAt?: number | null
  }
}>()

defineEmits<{
  refresh: []
  remove: []
  fetchVideos: []
}>()
</script>

<template>
  <article class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
    <NuxtLink :to="`/playlist/${playlist.id}`" class="block">
      <div class="aspect-video bg-gray-100 dark:bg-gray-800 relative">
        <img
          v-if="playlist.thumbnailUrl"
          :src="playlist.thumbnailUrl"
          :alt="playlist.title"
          class="w-full h-full object-cover"
        >
        <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
          <span class="i-heroicons-film text-4xl" aria-hidden="true" />
        </div>
        <UBadge
          v-if="playlist.privacyStatus === 'private'"
          class="absolute top-2 right-2"
          color="orange"
          variant="solid"
          size="xs"
        >
          Private
        </UBadge>
      </div>
    </NuxtLink>

    <div class="p-4">
      <NuxtLink :to="`/playlist/${playlist.id}`">
        <h2 class="font-semibold text-sm leading-snug line-clamp-2 hover:text-primary-600 dark:hover:text-primary-400">
          {{ playlist.title }}
        </h2>
      </NuxtLink>
      <p v-if="playlist.channelTitle" class="text-xs text-gray-500 mt-1 truncate">
        {{ playlist.channelTitle }}
      </p>
      <p class="text-xs text-gray-400 mt-1">
        {{ playlist.itemCount ?? '?' }} videos
        <span v-if="!playlist.videosCachedAt" class="ml-1 text-amber-500">· not fetched</span>
      </p>

      <div class="flex gap-2 mt-3">
        <UButton size="xs" variant="ghost" icon="i-heroicons-arrow-path" @click="$emit('refresh')">
          Refresh
        </UButton>
        <UButton
          v-if="!playlist.videosCachedAt"
          size="xs" variant="ghost" icon="i-heroicons-arrow-down-tray"
          @click="$emit('fetchVideos')"
        >
          Fetch
        </UButton>
        <UButton size="xs" variant="ghost" color="red" icon="i-heroicons-trash" @click="$emit('remove')">
          Remove
        </UButton>
      </div>
    </div>
  </article>
</template>
