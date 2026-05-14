<script setup lang="ts">
useHead({ title: 'Shared with me' })
const { data: rows, pending } = await useFetch('/api/playlists/shared')
</script>

<template>
  <div>
    <h1 class="text-xl font-bold mb-6">Shared with me</h1>

    <div v-if="pending" class="text-gray-400">Loading…</div>

    <div v-else-if="!rows?.length" class="text-center py-16 text-gray-400">
      <p>No playlists have been shared with you yet.</p>
    </div>

    <ul v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" aria-label="Shared playlists">
      <li v-for="row in rows" :key="row.playlist.id">
        <article class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
          <NuxtLink :to="`/playlist/${row.playlist.id}`" class="block">
            <div class="aspect-video bg-gray-100 dark:bg-gray-800">
              <img
                v-if="row.playlist.thumbnailUrl"
                :src="row.playlist.thumbnailUrl"
                :alt="row.playlist.title"
                class="w-full h-full object-cover"
              >
            </div>
          </NuxtLink>
          <div class="p-4">
            <NuxtLink :to="`/playlist/${row.playlist.id}`">
              <h2 class="font-semibold text-sm line-clamp-2">
                {{ row.playlist.title }}
              </h2>
            </NuxtLink>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ row.playlist.itemCount }} videos</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Shared by {{ row.sharedBy.displayName ?? row.sharedBy.email }}
            </p>
          </div>
        </article>
      </li>
    </ul>
  </div>
</template>
