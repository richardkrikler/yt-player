<script setup lang="ts">
const route = useRoute()
const router = useRouter()

// ── Filter state ─────────────────────────────────────────────────────
const q = ref('')

useHead({ title: computed(() => q.value ? `"${q.value}" – Search` : 'Search') })
const author = ref('')
const playlistId = ref('')
const duration = ref('')  // '' | 'short' | 'medium' | 'long'
const date = ref('')      // '' | 'week' | 'month' | '6months' | 'year'

// ── Pagination state ──────────────────────────────────────────────────
const page = ref(1)
const pageSize = 20
const total = ref(0)

// ── Accessible playlists for filter dropdown ─────────────────────────
const { data: ownedRaw } = await useFetch('/api/playlists')
const { data: sharedRaw } = await useFetch('/api/playlists/shared')

const playlistOptions = computed(() => [
  { value: '', label: 'All playlists' },
  ...(ownedRaw.value ?? []).map((p: any) => ({
    value: p.id,
    label: p.customTitle || p.title,
  })),
  ...(sharedRaw.value ?? []).map((r: any) => ({
    value: r.playlist.id,
    label: r.playlist.title,
  })),
])

// ── Duration presets ─────────────────────────────────────────────────
const durationOptions = [
  { value: 'short', label: '< 4 min' },
  { value: 'medium', label: '4–20 min' },
  { value: 'long', label: '> 20 min' },
]

// ── Date presets ─────────────────────────────────────────────────────
const dateOptions = [
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
  { value: '6months', label: 'Past 6 months' },
  { value: 'year', label: 'Past year' },
]

// ── Results ──────────────────────────────────────────────────────────
const results = ref<any[]>([])
const loading = ref(false)
const searchError = ref('')

const hasFilters = computed(() =>
  q.value.trim().length >= 2
  || author.value.trim().length > 0
  || playlistId.value !== ''
  || duration.value !== ''
  || date.value !== '',
)

async function doSearch() {
  if (!hasFilters.value) { results.value = []; total.value = 0; return }
  loading.value = true
  results.value = []
  total.value = 0
  searchError.value = ''
  try {
    const params: Record<string, string> = {
      page: String(page.value),
      pageSize: String(pageSize),
    }
    if (q.value.trim().length >= 2) params.q = q.value.trim()
    if (author.value.trim()) params.author = author.value.trim()
    if (playlistId.value) params.playlist = playlistId.value
    if (duration.value === 'short') params.durationMax = '240'
    if (duration.value === 'medium') { params.durationMin = '240'; params.durationMax = '1200' }
    if (duration.value === 'long') params.durationMin = '1200'
    if (date.value) {
      const days: Record<string, number> = { week: 7, month: 30, '6months': 180, year: 365 }
      if (days[date.value]) params.publishedAfter = String(Date.now() - days[date.value]! * 86400000)
    }
    const data = await $fetch<{ total: number; page: number; pageSize: number; results: any[] }>(
      '/api/search', { query: params },
    )
    total.value = data.total
    // Clamp page if it's beyond the last valid page (e.g. stale URL)
    const lastPage = Math.max(1, Math.ceil(data.total / pageSize))
    if (page.value > lastPage) {
      page.value = lastPage  // triggers a corrective re-search; skip updating results here
      return
    }
    results.value = data.results
  }
  catch (e: any) {
    searchError.value = e?.data?.message ?? 'Search failed'
    results.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

// ── URL ↔ state sync ─────────────────────────────────────────────────
function stateFromRoute() {
  const nq  = (route.query.q        as string) ?? ''
  const na  = (route.query.author   as string) ?? ''
  const np  = (route.query.playlist as string) ?? ''
  const nd  = (route.query.duration as string) ?? ''
  const ndt = (route.query.date     as string) ?? ''
  const npg = Math.max(1, parseInt(route.query.page as string) || 1)
  if (q.value        !== nq)  q.value        = nq
  if (author.value   !== na)  author.value   = na
  if (playlistId.value !== np) playlistId.value = np
  if (duration.value !== nd)  duration.value = nd
  if (date.value     !== ndt) date.value     = ndt
  if (page.value     !== npg) page.value     = npg
}
stateFromRoute()

watch(() => route.query, stateFromRoute, { deep: true })

let urlTimer: ReturnType<typeof setTimeout>
watch([q, author, playlistId, duration, date, page], () => {
  clearTimeout(urlTimer)
  urlTimer = setTimeout(() => {
    const params: Record<string, string> = {}
    if (q.value.trim())   params.q        = q.value.trim()
    if (author.value.trim()) params.author = author.value.trim()
    if (playlistId.value) params.playlist  = playlistId.value
    if (duration.value)   params.duration  = duration.value
    if (date.value)       params.date      = date.value
    if (page.value > 1)   params.page      = String(page.value)
    router.replace({ query: params })
  }, 300)
})

// ── Search triggers ───────────────────────────────────────────────────
// Reset to page 1 and clear stale results whenever any filter changes,
// so UPagination doesn't show old page buttons during the debounce window.
watch([q, author, playlistId, duration, date], () => {
  page.value = 1
  total.value = 0
  results.value = []
})

let searchTimer: ReturnType<typeof setTimeout>
watch([q, author, playlistId, duration, date, page], () => {
  clearTimeout(searchTimer)
  if (!hasFilters.value) { results.value = []; total.value = 0; return }
  searchTimer = setTimeout(doSearch, 300)
}, { immediate: true })

// ── Helpers ───────────────────────────────────────────────────────────
function resultHref(result: any) {
  return `/playlist/${result.item?.playlistId}/${result.video?.id}`
}

function formatDuration(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return null
  const h = parseInt(m[1] ?? '0')
  const min = parseInt(m[2] ?? '0')
  const sec = parseInt(m[3] ?? '0')
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${min}:${String(sec).padStart(2, '0')}`
}

function formatDate(ms: number | null | undefined): string | null {
  if (!ms) return null
  return new Date(ms).getFullYear().toString()
}

function toggleDuration(value: string) {
  duration.value = duration.value === value ? '' : value
}

function toggleDate(value: string) {
  date.value = date.value === value ? '' : value
}

// ── Channel combobox ──────────────────────────────────────────────────
const channelContainerEl = ref<HTMLElement | null>(null)
const channelResults = ref<string[]>([])
const channelSearching = ref(false)
const channelDropdownOpen = ref(false)
let channelProgrammatic = false

let channelTimer: ReturnType<typeof setTimeout>
watch(author, (q) => {
  if (channelProgrammatic) { channelProgrammatic = false; return }
  clearTimeout(channelTimer)
  if (q.trim().length < 1) { channelResults.value = []; channelDropdownOpen.value = false; return }
  channelTimer = setTimeout(async () => {
    channelSearching.value = true
    try {
      channelResults.value = await $fetch<string[]>('/api/channels/search', { query: { q: q.trim() } })
      channelDropdownOpen.value = true
    }
    catch { channelResults.value = [] }
    finally { channelSearching.value = false }
  }, 200)
})

function pickChannel(name: string) {
  channelProgrammatic = true
  author.value = name
  channelDropdownOpen.value = false
}

let channelFocusOutTimer: ReturnType<typeof setTimeout>
function onChannelFocusOut() {
  clearTimeout(channelFocusOutTimer)
  channelFocusOutTimer = setTimeout(() => {
    if (!channelContainerEl.value?.contains(document.activeElement)) channelDropdownOpen.value = false
  }, 150)
}
</script>

<template>
  <div class="max-w-4xl mx-auto flex flex-col gap-6">
    <h1 class="text-xl font-bold">Search</h1>

    <!-- Text query -->
    <UInput
      v-model="q"
      placeholder="Search by title or description…"
      :loading="loading"
      icon="i-heroicons-magnifying-glass"
      size="lg"
      autofocus
      @keydown.escape="q = ''"
    />

    <!-- Filters -->
    <div class="flex flex-col gap-3">
      <!-- Row 1: Playlist + Channel -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Playlist</span>
          <select
            v-model="playlistId"
            class="text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1 cursor-pointer"
          >
            <option v-for="opt in playlistOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div
          ref="channelContainerEl"
          class="flex items-center gap-2"
          @focusout="onChannelFocusOut"
        >
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Channel</span>
          <div class="relative">
            <UInput
              v-model="author"
              placeholder="Filter by channel…"
              :loading="channelSearching"
              size="sm"
              class="w-44"
              autocomplete="off"
              @focus="channelDropdownOpen = channelResults.length > 0"
              @keydown.escape="channelDropdownOpen = false; author = ''"
            />
            <div
              v-if="channelDropdownOpen && channelResults.length > 0"
              class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden"
              aria-label="Matching channels"
            >
              <button
                v-for="name in channelResults"
                :key="name"
                type="button"
                class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                @click="pickChannel(name)"
              >
                <UIcon name="i-heroicons-tv" class="size-4 text-gray-400 shrink-0" aria-hidden="true" />
                <span class="truncate">{{ name }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2: Duration + Uploaded -->
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Duration</span>
          <div class="flex gap-1" role="group" aria-label="Duration filter">
            <button
              v-for="opt in durationOptions"
              :key="opt.value"
              type="button"
              class="px-2.5 py-1 text-xs rounded-full border transition-colors"
              :class="duration === opt.value
                ? 'bg-primary-500 dark:bg-primary-400 text-white dark:text-gray-900 border-primary-500 dark:border-primary-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400'"
              :aria-pressed="duration === opt.value"
              @click="toggleDuration(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Uploaded</span>
          <div class="flex gap-1" role="group" aria-label="Upload date filter">
            <button
              v-for="opt in dateOptions"
              :key="opt.value"
              type="button"
              class="px-2.5 py-1 text-xs rounded-full border transition-colors"
              :class="date === opt.value
                ? 'bg-primary-500 dark:bg-primary-400 text-white dark:text-gray-900 border-primary-500 dark:border-primary-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400'"
              :aria-pressed="date === opt.value"
              @click="toggleDate(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <p v-if="searchError" role="alert" class="text-sm text-red-500">{{ searchError }}</p>

    <!-- Results -->
    <template v-if="hasFilters">
      <p v-if="loading" class="text-sm text-gray-400">Searching…</p>

      <template v-else-if="results.length > 0">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ total }} result{{ total === 1 ? '' : 's' }}
          <span class="text-gray-400 dark:text-gray-500">
            — page {{ page }} of {{ Math.ceil(total / pageSize) || 1 }}
          </span>
        </p>

        <ul
          class="flex flex-col divide-y divide-gray-100 dark:divide-gray-800"
          aria-label="Search results"
        >
          <li v-for="result in results" :key="`${result.item?.id}`">
            <NuxtLink
              :to="resultHref(result)"
              class="flex items-start gap-4 py-3 -mx-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <!-- Thumbnail -->
              <img
                v-if="result.video?.thumbnailUrl"
                :src="result.video.thumbnailUrl"
                :alt="result.video.title"
                class="w-28 h-[63px] object-cover rounded shrink-0"
              >
              <div
                v-else
                class="w-28 h-[63px] bg-gray-100 dark:bg-gray-800 rounded shrink-0 flex items-center justify-center"
              >
                <UIcon name="i-heroicons-film" class="size-6 text-gray-400" aria-hidden="true" />
              </div>

              <!-- Info -->
              <div class="min-w-0 flex-1 pt-0.5">
                <p class="text-sm font-medium line-clamp-2 leading-snug">
                  {{ result.video?.title }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-x-1.5">
                  <span v-if="result.video?.channelTitle" class="truncate max-w-[180px]">
                    {{ result.video.channelTitle }}
                  </span>
                  <span v-if="result.video?.channelTitle && (result.video?.duration || result.video?.publishedAt)" aria-hidden="true">·</span>
                  <span v-if="result.video?.duration">
                    {{ formatDuration(result.video.duration) }}
                  </span>
                  <span v-if="result.video?.duration && result.video?.publishedAt" aria-hidden="true">·</span>
                  <span v-if="result.video?.publishedAt">
                    {{ formatDate(result.video.publishedAt) }}
                  </span>
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                  {{ result.customTitle || result.playlist?.title }}
                </p>
              </div>
            </NuxtLink>
          </li>
        </ul>

        <!-- Pagination -->
        <div v-if="total > pageSize" class="flex justify-center pt-2">
          <UPagination
            v-model:page="page"
            :total="total"
            :items-per-page="pageSize"
          />
        </div>
      </template>

      <p v-else class="text-sm text-gray-400">
        No results found.
      </p>
    </template>

    <p v-else class="text-sm text-gray-400">
      Use the filters above to search across your playlists.
    </p>
  </div>
</template>
