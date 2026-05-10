<script setup lang="ts">
const { user, fetch: refreshSession } = useUserSession()
const route = useRoute()
const justConnected = computed(() => route.query.connected === '1')

async function disconnect() {
  await $fetch('/api/auth/youtube', { method: 'DELETE' })
  await refreshSession()
}
</script>

<template>
  <div class="max-w-lg">
    <h1 class="text-xl font-bold mb-6">Settings</h1>

    <UCard class="mb-4">
      <template #header>
        <h2 class="font-semibold">Profile</h2>
      </template>
      <dl class="flex flex-col gap-2 text-sm">
        <div class="flex justify-between">
          <dt class="text-gray-500">Email</dt>
          <dd class="font-medium">{{ user?.email }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-gray-500">Display name</dt>
          <dd>{{ user?.displayName ?? '—' }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-gray-500">Role</dt>
          <dd>
            <UBadge :color="user?.role === 'admin' ? 'primary' : 'gray'" variant="soft" size="xs">
              {{ user?.role }}
            </UBadge>
          </dd>
        </div>
      </dl>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">YouTube Connection</h2>
      </template>

      <div v-if="justConnected" role="status" class="text-sm text-green-600 mb-3">
        YouTube account connected successfully.
      </div>

      <div v-if="user?.youtubeConnected" class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="i-heroicons-check-circle text-green-500 text-lg" aria-hidden="true" />
          <span class="text-sm">Connected</span>
        </div>
        <UButton size="sm" color="red" variant="ghost" @click="disconnect">
          Disconnect
        </UButton>
      </div>

      <div v-else class="flex items-center justify-between">
        <p class="text-sm text-gray-500">
          Connect your YouTube account to import private playlists.
        </p>
        <UButton
          size="sm"
          icon="i-simple-icons-youtube"
          tag="a"
          href="/api/auth/youtube/connect"
        >
          Connect
        </UButton>
      </div>
    </UCard>
  </div>
</template>
