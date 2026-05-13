<script setup lang="ts">
const props = defineProps<{
  playlist: {
    id: string
    title: string
    customTitle?: string | null
    description?: string | null
    channelTitle?: string | null
    itemCount?: number | null
    privacyStatus?: string | null
    thumbnailUrl?: string | null
    videosCachedAt?: number | null
  }
  fetching?: boolean
}>()

const emit = defineEmits<{
  refresh: []
  remove: []
  fetchVideos: []
  rename: [title: string]
}>()

const editing = ref(false)
const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)
const titleEl = ref<HTMLElement | null>(null)

const { setPlaylistVTNames, backId } = usePlaylistTransition()

// Back-navigation: when this card is the morph target, stamp names before
// page:finish captures the new-state snapshot (onMounted fires before it).
onMounted(() => {
  if (backId.value === props.playlist.id) {
    setPlaylistVTNames(imgEl.value, titleEl.value)
    backId.value = null
  }
})

function startEdit() {
  draft.value = props.playlist.customTitle ?? ''
  editing.value = true
  nextTick(() => inputEl.value?.focus())
}

function commitEdit() {
  editing.value = false
  emit('rename', draft.value)
}

function cancelEdit() {
  editing.value = false
}

function activateTransition() {
  setPlaylistVTNames(imgEl.value, titleEl.value)
}
</script>

<template>
  <article class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
    <NuxtLink :to="`/playlist/${playlist.id}`" class="block" @click="activateTransition">
      <div class="aspect-video bg-gray-100 dark:bg-gray-800 relative">
        <img
          v-if="playlist.thumbnailUrl"
          ref="imgEl"
          :src="playlist.thumbnailUrl"
          :alt="playlist.title"
          class="w-full h-full object-cover"
        >
        <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
          <UIcon name="i-heroicons-film" class="w-10 h-10" aria-hidden="true" />
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
      <!-- Custom title (editable) -->
      <div class="group flex items-start gap-1 mb-0.5">
        <template v-if="editing">
          <input
            ref="inputEl"
            v-model="draft"
            class="flex-1 text-sm font-semibold bg-transparent border-b border-primary-500 outline-none leading-snug"
            placeholder="Custom title…"
            @keydown.enter="commitEdit"
            @keydown.escape="cancelEdit"
            @blur="commitEdit"
          >
        </template>
        <template v-else>
          <NuxtLink :to="`/playlist/${playlist.id}`" class="flex-1 min-w-0" @click="activateTransition">
            <h2
              ref="titleEl"
              class="font-semibold text-sm leading-snug line-clamp-2 hover:text-primary-600 dark:hover:text-primary-400"
            >
              {{ playlist.customTitle || playlist.title }}
            </h2>
          </NuxtLink>
          <button
            class="shrink-0 opacity-60 lg:opacity-0 lg:group-hover:opacity-60 hover:!opacity-100 transition-opacity mt-0.5"
            aria-label="Edit title"
            @click.prevent="startEdit"
          >
            <UIcon name="i-heroicons-pencil" class="w-3 h-3" />
          </button>
        </template>
      </div>

      <!-- YouTube title (secondary, shown only when custom title is set) -->
      <p v-if="playlist.customTitle" class="text-xs text-gray-600 dark:text-gray-400 truncate">
        {{ playlist.title }}
      </p>

      <p v-if="playlist.channelTitle" class="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
        {{ playlist.channelTitle }}
      </p>
      <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
        {{ playlist.itemCount ?? '?' }} videos
        <span v-if="!playlist.videosCachedAt" class="ml-1 text-amber-500">· not fetched</span>
      </p>

      <div class="flex gap-2 mt-3">
        <UButton size="xs" variant="ghost" icon="i-heroicons-arrow-path" @click="$emit('refresh')">
          Refresh
        </UButton>
        <UButton
          v-if="!playlist.videosCachedAt || fetching"
          size="xs" variant="ghost" icon="i-heroicons-arrow-down-tray"
          :loading="fetching"
          :disabled="fetching"
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
