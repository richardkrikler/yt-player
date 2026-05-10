<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { fetch: refreshSession } = useUserSession()
const displayName = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function register() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email: email.value, password: password.value, displayName: displayName.value },
    })
    await refreshSession()
    await navigateTo('/')
  }
  catch (e: any) {
    error.value = e?.data?.message ?? 'Registration failed'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-lg font-semibold">Create account</h1>
      <p class="text-sm text-gray-500 mt-1">The first account registered becomes admin.</p>
    </template>

    <form class="flex flex-col gap-4" @submit.prevent="register">
      <div class="flex flex-col gap-1.5">
        <label for="name" class="text-sm font-medium">Display name</label>
        <UInput id="name" v-model="displayName" type="text" autocomplete="name" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label for="email" class="text-sm font-medium">Email</label>
        <UInput id="email" v-model="email" type="email" autocomplete="email" required />
      </div>
      <div class="flex flex-col gap-1.5">
        <label for="password" class="text-sm font-medium">Password</label>
        <UInput id="password" v-model="password" type="password" autocomplete="new-password" required />
        <p class="text-xs text-gray-400">Minimum 8 characters</p>
      </div>
      <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
      <UButton type="submit" block :loading="loading">
        Create account
      </UButton>
    </form>

    <template #footer>
      <p class="text-sm text-center text-gray-500">
        Already have an account?
        <NuxtLink to="/login" class="text-primary-600 dark:text-primary-400 hover:underline">
          Sign in
        </NuxtLink>
      </p>
    </template>
  </UCard>
</template>
