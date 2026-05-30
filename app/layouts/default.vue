<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { user, clear } = useUserSession()

const desktopSearchBar = ref<{ focus: () => void } | null>(null)
useShortcuts([
  { key: 'k', meta: true, allowInInput: true, handler: () => desktopSearchBar.value?.focus() },
  { key: '/', handler: () => desktopSearchBar.value?.focus() },
])

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
  <div class="flex flex-col min-h-screen lg:h-screen lg:overflow-hidden bg-gray-50 dark:bg-gray-950">
    <UHeader
      style="view-transition-name: site-header"
      :ui="{ title: 'shrink-0 font-bold text-lg text-primary-600 dark:text-primary-400' }"
    >
      <template #title>YT Player</template>

      <!-- Search bar: desktop only (mobile gets an icon instead) -->
      <div class="hidden lg:flex flex-2 justify-center px-4">
        <AppSearchBar ref="desktopSearchBar" class="max-w-2xl w-full" />
      </div>

      <template #right>
        <!-- Mobile: plain search icon → /search -->
        <NuxtLink
          to="/search"
          class="lg:hidden flex items-center justify-center size-9 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Search"
        >
          <UIcon name="i-heroicons-magnifying-glass" class="size-5" aria-hidden="true" />
        </NuxtLink>

        <div class="hidden lg:flex items-center gap-1.5">
          <UNavigationMenu :items="items" aria-label="Main navigation" />
          <UButton variant="ghost" size="sm" @click="logout">
            Sign out
          </UButton>
        </div>
      </template>

      <template #body>
        <AppSearchBar class="mb-2" />
        <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" aria-label="Mobile navigation" />
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

    <main class="flex-1 lg:min-h-0 lg:overflow-y-auto max-w-7xl w-full mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>
