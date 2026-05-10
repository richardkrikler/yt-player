<script setup lang="ts">
const { query, results, loading, clear } = useSearch()
const open = computed(() => query.value.length >= 2)

function resultHref(result: any) {
  return `/playlist/${result.item?.playlistId}/${result.video?.id}`
}
</script>

<template>
  <div class="relative w-full">
    <UInput
      v-model="query"
      placeholder="Search videos…"
      :loading="loading"
      icon="i-heroicons-magnifying-glass"
      class="w-full"
      @keydown.escape="clear"
    />
    <div
      v-if="open"
      class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
      role="listbox"
      aria-label="Search results"
    >
      <div v-if="results.length === 0 && !loading" class="px-4 py-3 text-sm text-gray-500">
        No results found
      </div>
      <NuxtLink
        v-for="result in results"
        :key="result.item?.id"
        :to="resultHref(result)"
        class="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
        role="option"
        @click="clear"
      >
        <img
          v-if="result.video?.thumbnail_url"
          :src="result.video.thumbnail_url"
          :alt="result.video.title"
          class="w-12 h-9 object-cover rounded shrink-0"
        >
        <div class="min-w-0">
          <p class="text-sm font-medium truncate">{{ result.video?.title }}</p>
          <p class="text-xs text-gray-500 truncate">
            {{ result.playlist?.title }}
            <span v-if="result.video?.channel_title"> · {{ result.video.channel_title }}</span>
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
