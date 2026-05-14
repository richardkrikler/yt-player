<script setup lang="ts">
const { query, results, loading, clear } = useSearch()
const route = useRoute()
const router = useRouter()
const open = computed(() => query.value.length >= 2)
const containerEl = ref<HTMLElement | null>(null)

function resultHref(result: any) {
  return `/playlist/${result.item?.playlistId}/${result.video?.id}`
}

// ── Focus-out: delay so touch taps can complete before we clear ───────
// iOS does not set relatedTarget on touch-triggered focusout events, so
// contains(null) always returns false — without the delay the dropdown
// is destroyed before the tap's click event fires.
let focusOutTimer: ReturnType<typeof setTimeout>
function onFocusOut() {
  clearTimeout(focusOutTimer)
  focusOutTimer = setTimeout(() => {
    if (!containerEl.value?.contains(document.activeElement)) clear()
  }, 150)
}

function goToSearchPage() {
  if (query.value.trim().length < 2) return
  router.push(`/search?q=${encodeURIComponent(query.value.trim())}`)
  clear()
}

// Keyboard: Escape closes; Enter navigates (desktop / hardware keyboards)
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { clear(); return }
  if (e.key === 'Enter') goToSearchPage()
}

watch(route, clear)
</script>

<template>
  <div ref="containerEl" class="relative w-full" @focusout="onFocusOut" @keydown="onKeydown">
    <!--
      Wrapped in a <form> so the iOS virtual keyboard's "Go"/"Search" action
      fires a submit event, which is far more reliable than keydown on mobile.
    -->
    <form @submit.prevent="goToSearchPage">
      <UInput
        v-model="query"
        placeholder="Search videos…"
        :loading="loading"
        class="w-full"
      >
        <template #leading>
          <button
            type="button"
            class="flex items-center justify-center size-5 shrink-0"
            :class="query.trim().length >= 2
              ? 'text-primary-500 dark:text-primary-400 cursor-pointer'
              : 'text-gray-400 pointer-events-none'"
            :tabindex="query.trim().length >= 2 ? 0 : -1"
            :aria-label="query.trim().length >= 2 ? 'Open search page' : undefined"
            @click.stop="goToSearchPage"
          >
            <UIcon name="i-heroicons-magnifying-glass" class="size-5" />
          </button>
        </template>
      </UInput>
    </form>

    <div
      v-if="open"
      class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-100 overflow-y-auto"
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
        class="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        role="option"
        @click="clear"
      >
        <img
          v-if="result.video?.thumbnailUrl"
          :src="result.video.thumbnailUrl"
          :alt="result.video.title"
          class="w-12 h-9 object-cover rounded shrink-0"
        >
        <div v-else class="w-12 h-9 bg-gray-100 dark:bg-gray-800 rounded shrink-0" />
        <div class="min-w-0">
          <p class="text-sm font-medium truncate">{{ result.video?.title }}</p>
          <p class="text-xs text-gray-500 truncate">
            {{ result.customTitle || result.playlist?.title }}
            <span v-if="result.video?.channelTitle"> · {{ result.video.channelTitle }}</span>
          </p>
        </div>
      </NuxtLink>

      <!-- See all results -->
      <NuxtLink
        v-if="results.length > 0"
        :to="`/search?q=${encodeURIComponent(query.trim())}`"
        class="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-xs text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        @click="clear"
      >
        See all results
        <UIcon name="i-heroicons-arrow-right" class="size-3" aria-hidden="true" />
      </NuxtLink>
    </div>
  </div>
</template>
