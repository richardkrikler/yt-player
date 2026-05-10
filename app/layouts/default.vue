<script setup lang="ts">
const { user, clear } = useUserSession()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
      <nav class="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4" aria-label="Main navigation">
        <NuxtLink to="/" class="font-bold text-lg text-primary-600 dark:text-primary-400 shrink-0">
          YT Player
        </NuxtLink>

        <div class="flex-1 flex items-center gap-2 max-w-sm">
          <AppSearchBar />
        </div>

        <div class="flex items-center gap-3 ml-auto">
          <NuxtLink to="/shared" class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            Shared
          </NuxtLink>
          <NuxtLink
            v-if="user?.role === 'admin'"
            to="/admin"
            class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Admin
          </NuxtLink>
          <NuxtLink to="/settings" class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            Settings
          </NuxtLink>
          <UButton variant="ghost" size="sm" @click="logout">
            Sign out
          </UButton>
        </div>
      </nav>
    </header>

    <main class="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>
