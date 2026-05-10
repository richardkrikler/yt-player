<script setup lang="ts">
const { user } = useUserSession()
const { playlists, loading, error, fetchPlaylists, importFromUrl, removePlaylist, refreshMetadata, fetchVideos } = usePlaylist()

// import from YouTube state
const showYTImport = ref(false)
const ytPlaylists = ref<any[]>([])
const ytLoading = ref(false)
const selected = ref<Set<string>>(new Set())
const importing = ref(false)

// public URL import
const urlInput = ref('')
const urlError = ref('')
const urlLoading = ref(false)

onMounted(fetchPlaylists)

async function loadYTPlaylists() {
  showYTImport.value = true
  ytLoading.value = true
  try {
    ytPlaylists.value = await $fetch('/api/playlists/mine/youtube')
  }
  catch (e: any) {
    ytPlaylists.value = []
  }
  finally {
    ytLoading.value = false
  }
}

function toggleSelect(id: string) {
  selected.value.has(id) ? selected.value.delete(id) : selected.value.add(id)
  selected.value = new Set(selected.value)
}

async function importSelected() {
  if (selected.value.size === 0) return
  importing.value = true
  try {
    await $fetch('/api/playlists/import', {
      method: 'POST',
      body: { ids: [...selected.value] },
    })
    showYTImport.value = false
    selected.value = new Set()
    await fetchPlaylists()
  }
  finally {
    importing.value = false
  }
}

async function addFromUrl() {
  urlError.value = ''
  if (!urlInput.value.trim()) return
  urlLoading.value = true
  try {
    await importFromUrl(urlInput.value)
    urlInput.value = ''
    await fetchPlaylists()
  }
  catch (e: any) {
    urlError.value = e?.data?.message ?? 'Failed to import'
  }
  finally {
    urlLoading.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <h1 class="text-xl font-bold">My Playlists</h1>
      <div class="flex gap-2 flex-wrap">
        <UButton
          v-if="user?.youtubeConnected"
          icon="i-heroicons-arrow-down-tray"
          variant="outline"
          @click="loadYTPlaylists"
        >
          Import from YouTube
        </UButton>
        <NuxtLink v-else to="/settings">
          <UButton variant="outline" icon="i-simple-icons-youtube">Connect YouTube</UButton>
        </NuxtLink>
      </div>
    </div>

    <!-- Public playlist URL import -->
    <form class="flex gap-2 mb-6" @submit.prevent="addFromUrl">
      <UInput
        v-model="urlInput"
        placeholder="Paste a YouTube playlist URL to add a public playlist…"
        class="flex-1"
        :disabled="urlLoading"
      />
      <UButton type="submit" :loading="urlLoading">Add</UButton>
    </form>
    <p v-if="urlError" role="alert" class="text-sm text-red-500 -mt-4 mb-4">{{ urlError }}</p>

    <!-- YouTube import picker -->
    <div v-if="showYTImport" class="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold">Your YouTube playlists</h2>
        <div class="flex gap-2">
          <UButton size="sm" :disabled="selected.size === 0" :loading="importing" @click="importSelected">
            Import {{ selected.size > 0 ? `(${selected.size})` : '' }}
          </UButton>
          <UButton size="sm" variant="ghost" @click="showYTImport = false">Cancel</UButton>
        </div>
      </div>
      <div v-if="ytLoading" class="py-8 text-center text-gray-400">Loading…</div>
      <ul v-else class="flex flex-col gap-1 max-h-72 overflow-y-auto">
        <li
          v-for="pl in ytPlaylists"
          :key="pl.id"
        >
          <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
            <input
              type="checkbox"
              :checked="selected.has(pl.id)"
              class="rounded"
              @change="toggleSelect(pl.id)"
            >
            <img
              v-if="pl.thumbnailUrl"
              :src="pl.thumbnailUrl"
              :alt="pl.title"
              class="w-12 h-9 object-cover rounded shrink-0"
            >
            <div class="min-w-0">
              <p class="text-sm font-medium truncate">{{ pl.title }}</p>
              <p class="text-xs text-gray-500">{{ pl.itemCount }} videos · {{ pl.privacyStatus }}</p>
            </div>
          </label>
        </li>
      </ul>
    </div>

    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <div v-for="n in 4" :key="n" class="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
    </div>

    <p v-else-if="error" role="alert" class="text-red-500">{{ error }}</p>

    <div v-else-if="playlists.length === 0" class="text-center py-16 text-gray-400">
      <p class="text-lg">No playlists yet</p>
      <p class="text-sm mt-1">Import from YouTube or add a public playlist URL above.</p>
    </div>

    <ul
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      aria-label="Playlist collection"
    >
      <li v-for="pl in playlists" :key="pl.id">
        <PlaylistCard
          :playlist="pl"
          @refresh="refreshMetadata(pl.id)"
          @fetch-videos="fetchVideos(pl.id)"
          @remove="removePlaylist(pl.id)"
        />
      </li>
    </ul>
  </div>
</template>
