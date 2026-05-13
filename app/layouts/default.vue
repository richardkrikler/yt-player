<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { user, clear } = useUserSession()

const items = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Shared',
    to: '/shared',
    icon: 'i-heroicons-share',
  },
  ...(user.value?.role === 'admin' ? [{
    label: 'Admin',
    to: '/admin',
    icon: 'i-heroicons-shield-check',
  }] : []),
  {
    label: 'Settings',
    to: '/settings',
    icon: 'i-heroicons-cog-6-tooth',
  },
])

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  navigateTo('/login')
}
</script>

<template>
  <div class="h-screen overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-950">
    <UHeader style="view-transition-name: site-header">
      <template #title>
        <NuxtLink to="/" class="font-bold text-lg text-primary-600 dark:text-primary-400">
          YT Player
        </NuxtLink>
      </template>

      <div class="flex-2 flex justify-center px-4">
        <AppSearchBar class="max-w-2xl w-full" />
      </div>

      <template #right>
        <div class="hidden lg:flex items-center gap-1.5">
          <UNavigationMenu :items="items" />
          <UButton variant="ghost" size="sm" @click="logout">
            Sign out
          </UButton>
        </div>
      </template>

      <template #body>
        <AppSearchBar class="mb-2" />
        <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
        <div class="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
          <button
            class="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            @click="logout"
          >
            <UIcon name="i-heroicons-arrow-right-on-rectangle" class="size-5 shrink-0" />
            Sign out
          </button>
        </div>
      </template>
    </UHeader>

    <main class="flex-1 min-h-0 overflow-y-auto max-w-7xl w-full mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>
