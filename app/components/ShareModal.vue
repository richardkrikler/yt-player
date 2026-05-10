<script setup lang="ts">
const props = defineProps<{
  playlistId: string
  open: boolean
}>()

defineEmits<{ 'update:open': [value: boolean] }>()

const email = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

async function share() {
  error.value = ''
  success.value = ''
  if (!email.value.trim()) return

  loading.value = true
  try {
    await $fetch(`/api/playlists/${props.playlistId}/share`, {
      method: 'POST',
      body: { email: email.value.trim() },
    })
    success.value = `Shared with ${email.value}`
    email.value = ''
  }
  catch (e: any) {
    error.value = e?.data?.message ?? 'Failed to share'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal :open="open" title="Share playlist" @update:open="$emit('update:open', $event)">
    <template #body>
      <form class="flex flex-col gap-4" @submit.prevent="share">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Enter the email address of a registered user to share this playlist with them.
        </p>
        <UInput
          v-model="email"
          type="email"
          placeholder="user@example.com"
          :disabled="loading"
          required
        />
        <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
        <p v-if="success" role="status" class="text-sm text-green-600">{{ success }}</p>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" type="button" @click="$emit('update:open', false)">
            Close
          </UButton>
          <UButton type="submit" :loading="loading">
            Share
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
