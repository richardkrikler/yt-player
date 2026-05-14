<script setup lang="ts">
type UserResult = { id: number; email: string; displayName: string | null }

const props = defineProps<{
  playlistId: string
  open: boolean
}>()

defineEmits<{ 'update:open': [value: boolean] }>()

// ── User search ──────────────────────────────────────────────────────
const searchQuery = ref('')
const searchResults = ref<UserResult[]>([])
const searching = ref(false)
const dropdownOpen = ref(false)
const selected = ref<UserResult | null>(null)
const containerEl = ref<HTMLElement | null>(null)

function userLabel(u: UserResult) {
  return u.displayName ? `${u.displayName} (${u.email})` : u.email
}

// Flag to skip the watcher when we programmatically update the input
// (after picking a result or resetting) so we don't fire a redundant search.
let programmatic = false

let searchTimer: ReturnType<typeof setTimeout>
watch(searchQuery, (q) => {
  if (programmatic) { programmatic = false; return }
  clearTimeout(searchTimer)
  selected.value = null
  if (q.trim().length < 2) {
    searchResults.value = []
    dropdownOpen.value = false
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      searchResults.value = await $fetch<UserResult[]>('/api/users/search', { query: { q: q.trim() } })
      dropdownOpen.value = true
    }
    catch {
      searchResults.value = []
    }
    finally {
      searching.value = false
    }
  }, 300)
})

function pick(u: UserResult) {
  programmatic = true
  selected.value = u
  searchQuery.value = userLabel(u)
  dropdownOpen.value = false
}

let focusOutTimer: ReturnType<typeof setTimeout>
function onFocusOut() {
  clearTimeout(focusOutTimer)
  focusOutTimer = setTimeout(() => {
    if (!containerEl.value?.contains(document.activeElement)) dropdownOpen.value = false
  }, 150)
}

// ── Share ────────────────────────────────────────────────────────────
const error = ref('')
const success = ref('')
const loading = ref(false)

async function share() {
  if (!selected.value) return
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    await $fetch(`/api/playlists/${props.playlistId}/share`, {
      method: 'POST',
      body: { email: selected.value.email },
    })
    success.value = `Shared with ${userLabel(selected.value)}`
    programmatic = true
    searchQuery.value = ''
    selected.value = null
  }
  catch (e: any) {
    error.value = e?.data?.message ?? 'Failed to share'
  }
  finally {
    loading.value = false
  }
}

// Reset state when modal closes
watch(() => props.open, (v) => {
  if (!v) {
    clearTimeout(searchTimer)
    programmatic = true
    searchQuery.value = ''
    selected.value = null
    error.value = ''
    success.value = ''
    searchResults.value = []
    dropdownOpen.value = false
  }
})
</script>

<template>
  <UModal :open="open" title="Share playlist" @update:open="$emit('update:open', $event)">
    <template #body>
      <form class="flex flex-col gap-4" @submit.prevent="share">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Search for a registered user to share this playlist with.
        </p>

        <!-- User search combobox -->
        <div ref="containerEl" class="relative" @focusout="onFocusOut">
          <UInput
            v-model="searchQuery"
            placeholder="Search by name or email…"
            :loading="searching"
            icon="i-heroicons-user"
            autocomplete="off"
            @focus="dropdownOpen = searchResults.length > 0"
            @keydown.escape="dropdownOpen = false"
          />

          <!-- Results dropdown -->
          <div
            v-if="dropdownOpen && searchResults.length > 0"
            class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden"
            role="listbox"
            aria-label="Matching users"
          >
            <button
              v-for="u in searchResults"
              :key="u.id"
              type="button"
              class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              role="option"
              :aria-selected="selected?.id === u.id"
              @click="pick(u)"
            >
              <UIcon name="i-heroicons-user-circle" class="size-5 text-gray-400 shrink-0" aria-hidden="true" />
              <span class="truncate">{{ userLabel(u) }}</span>
            </button>
          </div>

          <!-- No results -->
          <div
            v-else-if="dropdownOpen && !searching && searchResults.length === 0"
            class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 px-4 py-3"
          >
            <p class="text-sm text-gray-500">No users found.</p>
          </div>
        </div>

        <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
        <p v-if="success" role="status" class="text-sm text-green-600">{{ success }}</p>

        <div class="flex justify-end gap-2">
          <UButton variant="ghost" type="button" @click="$emit('update:open', false)">
            Close
          </UButton>
          <UButton type="submit" :loading="loading" :disabled="!selected">
            Share
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
