<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <NuxtLink to="/" class="text-2xl font-bold text-primary-600 dark:text-primary-400">
          YT Player
        </NuxtLink>
      </div>
      <slot />
    </div>
  </div>
</template>
