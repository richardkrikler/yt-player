<script setup lang="ts">
import type Sortable from 'sortablejs'

definePageMeta({ viewTransition: { fromTypes: ['vt-forward'] } })
useHead({ title: 'My Playlists' })
const { user } = useUserSession()
const { playlists, loading, error, youtubeAuthExpired, fetchPlaylists, importFromUrl, removePlaylist, refreshMetadata, fetchVideos, renamePlaylist } = usePlaylist()

async function handleRemove(pl: any) {
  const label = pl.customTitle || pl.title
  if (!confirm(`Remove "${label}" from your library?\nThis cannot be undone.`)) return
  await removePlaylist(pl.id)
}

// ── Drag-to-reorder ───────────────────────────────────────────────────
const gridEl = ref<HTMLElement | null>(null)
const reordering = ref(false)
let sortable: InstanceType<typeof Sortable> | null = null

async function toggleReorder() {
  if (reordering.value) {
    reordering.value = false
    sortable?.destroy()
    sortable = null
    return
  }
  reordering.value = true
  await nextTick()
  if (!gridEl.value) return
  const { default: SortableJS } = await import('sortablejs')
  sortable = new SortableJS(gridEl.value, {
    animation: 200,
    ghostClass: 'sortable-ghost',
    onEnd(evt) {
      const { oldIndex, newIndex } = evt
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return
      const arr = [...playlists.value]
      const [moved] = arr.splice(oldIndex, 1)
      arr.splice(newIndex, 0, moved)
      playlists.value = arr
      $fetch('/api/playlists/order', { method: 'PATCH', body: { ids: arr.map(p => p.id) } })
    },
  })
}

const fetchingIds = ref<Set<string>>(new Set())

async function handleFetchVideos(id: string) {
  fetchingIds.value = new Set([...fetchingIds.value, id])
  try {
    await fetchVideos(id)
    const updated = await refreshMetadata(id)
    const idx = playlists.value.findIndex(p => p.id === id)
    if (idx !== -1) playlists.value[idx] = { ...playlists.value[idx], videosCachedAt: updated.videosCachedAt ?? Date.now() }
  }
  finally {
    fetchingIds.value = new Set([...fetchingIds.value].filter(x => x !== id))
  }
}

// import from YouTube state
const showYTImport = ref(false)
const ytPlaylists = ref<any[]>([])
const ytLoading = ref(false)
const selected = ref<Set<string>>(new Set())
const importing = ref(false)

const ytError = ref('')

// public URL import
const urlInput = ref('')
const urlError = ref('')
const urlLoading = ref(false)

onMounted(fetchPlaylists)

async function loadYTPlaylists() {
  showYTImport.value = true
  ytLoading.value = true
  ytError.value = ''
  try {
    const data = await $fetch('/api/playlists/mine/youtube')
    ytPlaylists.value = data.slice().sort((a: any, b: any) => a.title.localeCompare(b.title))
  }
  catch (e: any) {
    ytPlaylists.value = []
    if (e?.status === 401) {
      showYTImport.value = false
      youtubeAuthExpired.value = true
    }
    else {
      ytError.value = e?.data?.message ?? 'Failed to load playlists'
    }
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
          v-if="playlists.length > 1"
          :icon="reordering ? 'i-heroicons-check' : 'i-heroicons-bars-3-bottom-left'"
          :variant="reordering ? 'solid' : 'outline'"
          @click="toggleReorder"
        >
          {{ reordering ? 'Done' : 'Reorder' }}
        </UButton>
        <UButton
          v-if="user?.youtubeConnected && !reordering"
          icon="i-heroicons-arrow-down-tray"
          variant="outline"
          @click="loadYTPlaylists"
        >
          Import from YouTube
        </UButton>
        <NuxtLink v-else-if="!reordering && !user?.youtubeConnected" to="/settings">
          <UButton variant="outline" icon="i-simple-icons-youtube">Connect YouTube</UButton>
        </NuxtLink>
      </div>
    </div>

    <UAlert
      v-if="youtubeAuthExpired"
      title="YouTube authorization expired"
      description="Your YouTube connection has expired. Reconnect to resume importing and refreshing private playlists."
      color="error"
      variant="outline"
      orientation="horizontal"
      class="mb-6"
      :actions="[{ label: 'Reconnect YouTube', to: '/settings', icon: 'i-simple-icons-youtube' }]"
    />

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
      <p v-else-if="ytError" role="alert" class="text-sm text-red-500 py-4 text-center">{{ ytError }}</p>
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
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ pl.itemCount }} videos · {{ pl.privacyStatus }}</p>
            </div>
          </label>
        </li>
      </ul>
    </div>

    <div v-if="loading && playlists.length === 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <div v-for="n in 4" :key="n" class="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
    </div>

    <p v-else-if="error" role="alert" class="text-red-500">{{ error }}</p>

    <div v-else-if="playlists.length === 0" class="text-center py-16 text-gray-400">
      <p class="text-lg">No playlists yet</p>
      <p class="text-sm mt-1">Import from YouTube or add a public playlist URL above.</p>
    </div>

    <ul
      v-else
      ref="gridEl"
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      aria-label="Playlist collection"
    >
      <li v-for="pl in playlists" :key="pl.id">
        <PlaylistCard
          :playlist="pl"
          :fetching="fetchingIds.has(pl.id)"
          :reordering="reordering"
          @refresh="(done) => handleFetchVideos(pl.id).then(() => done(true)).catch(() => done(false))"
          @fetch-videos="handleFetchVideos(pl.id)"
          @remove="handleRemove(pl)"
          @rename="renamePlaylist(pl.id, $event)"
        />
      </li>
    </ul>
  </div>
</template>
