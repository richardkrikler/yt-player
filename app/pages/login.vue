<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Login' })

const { fetch: refreshSession } = useUserSession()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function login() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    await refreshSession()
    await navigateTo('/')
  }
  catch (e: any) {
    error.value = e?.data?.message ?? 'Login failed'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-lg font-semibold">Sign in</h1>
    </template>

    <form class="flex flex-col gap-4" @submit.prevent="login">
      <div class="flex flex-col gap-1.5">
        <label for="email" class="text-sm font-medium">Email</label>
        <UInput id="email" v-model="email" type="email" autocomplete="username" required />
      </div>
      <div class="flex flex-col gap-1.5">
        <label for="password" class="text-sm font-medium">Password</label>
        <UInput id="password" v-model="password" type="password" autocomplete="current-password" required />
      </div>
      <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
      <UButton type="submit" block :loading="loading">
        Sign in
      </UButton>
    </form>

    <template #footer>
      <p class="text-sm text-center text-gray-500">
        No account?
        <NuxtLink to="/register" class="text-primary-600 dark:text-primary-400 hover:underline transition-colors">
          Register
        </NuxtLink>
      </p>
    </template>
  </UCard>
</template>
