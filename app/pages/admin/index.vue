<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin' })

const { data: users, refresh: refreshUsers } = await useFetch('/api/admin/users')
const { data: playlists } = await useFetch('/api/admin/playlists')

const adminCount = computed(() => (users.value ?? []).filter((u: any) => u.role === 'admin').length)
const isLastAdmin = (u: any) => u.role === 'admin' && adminCount.value === 1

async function setRole(id: number, role: 'admin' | 'user') {
  await $fetch(`/api/admin/users/${id}`, { method: 'PATCH', body: { role } })
  await refreshUsers()
}

async function deleteUser(id: number, email: string) {
  if (!confirm(`Delete user "${email}" and all their data?\nThis cannot be undone.`)) return
  await $fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
  await refreshUsers()
}

const rowState = ref<Map<string, 'idle' | 'loading' | 'done'>>(new Map())

function getRowState(id: string) {
  return rowState.value.get(id) ?? 'idle'
}

async function refreshPlaylist(id: string) {
  if (getRowState(id) === 'loading') return
  rowState.value = new Map(rowState.value).set(id, 'loading')
  try {
    const updated: any = await $fetch(`/api/admin/playlists/${id}/refresh`, { method: 'POST' })
    const row = (playlists.value as any[])?.find((r: any) => r.playlist.id === id)
    if (row) row.playlist = { ...row.playlist, ...updated }
    rowState.value = new Map(rowState.value).set(id, 'done')
    setTimeout(() => {
      rowState.value = new Map(rowState.value).set(id, 'idle')
    }, 1500)
  }
  catch {
    rowState.value = new Map(rowState.value).set(id, 'idle')
  }
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <h1 class="text-xl font-bold">Admin</h1>

    <!-- Users -->
    <section aria-labelledby="users-heading">
      <h2 id="users-heading" class="font-semibold mb-3">Users</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
              <th class="py-2 pr-4 font-medium">Email</th>
              <th class="py-2 pr-4 font-medium">Name</th>
              <th class="py-2 pr-4 font-medium">Role</th>
              <th class="py-2 pr-4 font-medium">YouTube</th>
              <th class="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in users"
              :key="u.id"
              class="border-b border-gray-100 dark:border-gray-800"
            >
              <td class="py-2 pr-4">{{ u.email }}</td>
              <td class="py-2 pr-4 text-gray-500 dark:text-gray-400">{{ u.displayName ?? '—' }}</td>
              <td class="py-2 pr-4">
                <UBadge :color="u.role === 'admin' ? 'primary' : 'gray'" variant="soft" size="sm">
                  {{ u.role }}
                </UBadge>
              </td>
              <td class="py-2 pr-4">
                <span v-if="u.youtubeConnectedAt" class="text-green-500 text-xs">Connected</span>
                <span v-else class="text-gray-400 text-xs">—</span>
              </td>
              <td class="py-2 flex gap-2">
                <UButton
                  size="xs"
                  variant="ghost"
                  :disabled="isLastAdmin(u)"
                  :title="isLastAdmin(u) ? 'Cannot demote the last admin' : undefined"
                  @click="setRole(u.id, u.role === 'admin' ? 'user' : 'admin')"
                >
                  Make {{ u.role === 'admin' ? 'user' : 'admin' }}
                </UButton>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  :disabled="isLastAdmin(u)"
                  :title="isLastAdmin(u) ? 'Cannot delete the last admin' : undefined"
                  @click="deleteUser(u.id, u.email)"
                >
                  Delete
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Playlists -->
    <section aria-labelledby="playlists-heading">
      <h2 id="playlists-heading" class="font-semibold mb-3">All Playlists</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
              <th class="py-2 pr-4 font-medium">Title</th>
              <th class="py-2 pr-4 font-medium">Users</th>
              <th class="py-2 pr-4 font-medium">Videos</th>
              <th class="py-2 pr-4 font-medium">Privacy</th>
              <th class="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in playlists"
              :key="row.playlist.id"
              class="border-b border-gray-100 dark:border-gray-800"
            >
              <td class="py-2 pr-4 pl-1">
                <NuxtLink :to="`/playlist/${row.playlist.id}`" class="hover:text-primary-600 dark:hover:text-primary-400">
                  {{ row.playlist.title }}
                </NuxtLink>
              </td>
              <td class="py-2 pr-4 text-gray-500 dark:text-gray-400">{{ row.userCount }}</td>
              <td class="py-2 pr-4">{{ row.playlist.itemCount }}</td>
              <td class="py-2 pr-4">
                <UBadge
                  :color="row.playlist.privacyStatus === 'private' ? 'orange' : 'gray'"
                  variant="soft"
                  size="sm"
                >
                  {{ row.playlist.privacyStatus ?? '?' }}
                </UBadge>
              </td>
              <td class="py-2">
                <UButton
                  v-if="row.playlist.videosCachedAt"
                  size="xs" variant="ghost"
                  :disabled="getRowState(row.playlist.id) === 'loading'"
                  @click="refreshPlaylist(row.playlist.id)"
                >
                  <UIcon
                    :name="getRowState(row.playlist.id) === 'done' ? 'i-heroicons-check' : 'i-heroicons-arrow-path'"
                    :class="{ 'animate-spin': getRowState(row.playlist.id) === 'loading' }"
                  />
                  Refresh
                </UButton>
                <UButton
                  v-else
                  size="xs" variant="ghost" icon="i-heroicons-arrow-down-tray"
                  :loading="getRowState(row.playlist.id) === 'loading'"
                  :disabled="getRowState(row.playlist.id) === 'loading'"
                  @click="refreshPlaylist(row.playlist.id)"
                >
                  Fetch
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
