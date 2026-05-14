<script setup lang="ts">
useHead({ title: 'Shared' })

const { data: received, refresh: refreshReceived } = await useFetch('/api/playlists/shared')
const { data: sent, refresh: refreshSent } = await useFetch('/api/playlists/shared-by-me')

// ── Group helpers ─────────────────────────────────────────────────────
interface SharedPlaylist {
  id: string; title: string; thumbnailUrl: string | null
  itemCount: number | null; customTitle?: string | null
}
interface ReceivedGroup { user: { displayName: string | null; email: string }; playlists: SharedPlaylist[] }
interface SentGroup { user: { id: number; displayName: string | null; email: string }; playlists: SharedPlaylist[] }

const receivedGroups = computed(() => {
  const map = new Map<string, ReceivedGroup>()
  for (const row of received.value ?? []) {
    const key = row.sharedBy.email
    if (!map.has(key)) map.set(key, { user: row.sharedBy, playlists: [] })
    map.get(key)!.playlists.push(row.playlist)
  }
  return [...map.values()]
})

const sentGroups = computed(() => {
  const map = new Map<number, SentGroup>()
  for (const row of sent.value ?? []) {
    const key = row.sharedWith.id
    if (!map.has(key)) map.set(key, { user: row.sharedWith, playlists: [] })
    map.get(key)!.playlists.push({ ...row.playlist, customTitle: row.customTitle })
  }
  return [...map.values()]
})

function userLabel(u: { displayName: string | null; email: string }) {
  return u.displayName ? `${u.displayName} (${u.email})` : u.email
}

// ── Actions ───────────────────────────────────────────────────────────
async function leaveShare(playlistId: string, playlistTitle: string) {
  if (!confirm(`Leave "${playlistTitle}"?\nYou will lose access to this playlist.`)) return
  await $fetch(`/api/playlists/${playlistId}/leave`, { method: 'DELETE' })
  await refreshReceived()
}

async function revokeShare(playlistId: string, targetUserId: number, targetName: string, playlistTitle: string) {
  if (!confirm(`Revoke access to "${playlistTitle}" for ${targetName}?`)) return
  await $fetch(`/api/playlists/${playlistId}/share/${targetUserId}`, { method: 'DELETE' })
  await refreshSent()
}
</script>

<template>
  <div class="flex flex-col gap-10">
    <h1 class="text-xl font-bold">Shared</h1>

    <!-- ── Shared with me ───────────────────────────────────────────── -->
    <section aria-labelledby="received-heading">
      <h2 id="received-heading" class="font-semibold mb-4">Shared with me</h2>

      <p v-if="!receivedGroups.length" class="text-sm text-gray-400">
        No playlists have been shared with you yet.
      </p>

      <div v-else class="flex flex-col gap-3">
        <div
          v-for="group in receivedGroups"
          :key="group.user.email"
          class="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden"
        >
          <!-- User header -->
          <div class="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <UIcon name="i-heroicons-user-circle" class="size-4 text-gray-400 shrink-0" aria-hidden="true" />
            <span class="text-sm font-medium">{{ userLabel(group.user) }}</span>
          </div>

          <!-- Playlists -->
          <ul>
            <li
              v-for="pl in group.playlists"
              :key="pl.id"
              class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0"
            >
              <NuxtLink :to="`/playlist/${pl.id}`" class="flex items-center gap-3 flex-1 min-w-0">
                <img
                  v-if="pl.thumbnailUrl"
                  :src="pl.thumbnailUrl"
                  :alt="pl.title"
                  class="w-14 h-[39px] object-cover rounded shrink-0"
                >
                <div v-else class="w-14 h-[39px] bg-gray-100 dark:bg-gray-800 rounded shrink-0" />
                <div class="min-w-0">
                  <p class="text-sm font-medium truncate">{{ pl.title }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ pl.itemCount ?? '?' }} videos</p>
                </div>
              </NuxtLink>
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                @click="leaveShare(pl.id, pl.title)"
              >
                Leave
              </UButton>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ── My shares ────────────────────────────────────────────────── -->
    <section aria-labelledby="sent-heading">
      <h2 id="sent-heading" class="font-semibold mb-4">My shares</h2>

      <p v-if="!sentGroups.length" class="text-sm text-gray-400">
        You haven't shared any playlists yet.
      </p>

      <div v-else class="flex flex-col gap-3">
        <div
          v-for="group in sentGroups"
          :key="group.user.id"
          class="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden"
        >
          <!-- User header -->
          <div class="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <UIcon name="i-heroicons-user-circle" class="size-4 text-gray-400 shrink-0" aria-hidden="true" />
            <span class="text-sm font-medium">{{ userLabel(group.user) }}</span>
          </div>

          <!-- Playlists -->
          <ul>
            <li
              v-for="pl in group.playlists"
              :key="pl.id"
              class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0"
            >
              <NuxtLink :to="`/playlist/${pl.id}`" class="flex items-center gap-3 flex-1 min-w-0">
                <img
                  v-if="pl.thumbnailUrl"
                  :src="pl.thumbnailUrl"
                  :alt="pl.title"
                  class="w-14 h-[39px] object-cover rounded shrink-0"
                >
                <div v-else class="w-14 h-[39px] bg-gray-100 dark:bg-gray-800 rounded shrink-0" />
                <div class="min-w-0">
                  <p class="text-sm font-medium truncate">{{ pl.customTitle || pl.title }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ pl.itemCount ?? '?' }} videos</p>
                </div>
              </NuxtLink>
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                @click="revokeShare(pl.id, group.user.id, userLabel(group.user), pl.customTitle || pl.title)"
              >
                Revoke
              </UButton>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>
