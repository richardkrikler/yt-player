<script setup lang="ts">
defineProps<{ open: boolean }>()
defineEmits<{ 'update:open': [value: boolean] }>()

const sections = [
  {
    title: 'Global',
    rows: [
      { combos: [['⌘', 'K'], ['/']], description: 'Focus search' },
      { combos: [['?']], description: 'Show this shortcuts list' },
    ],
  },
  {
    title: 'Player',
    rows: [
      { combos: [['Space'], ['K']], description: 'Play / Pause' },
      { combos: [['←']], description: 'Seek back 5 s' },
      { combos: [['→']], description: 'Seek forward 5 s' },
      { combos: [['J']], description: 'Seek back 10 s' },
      { combos: [['L']], description: 'Seek forward 10 s' },
      { combos: [['⇧', 'N']], description: 'Next in list' },
      { combos: [['⇧', 'P']], description: 'Previous in list' },
      { combos: [['R']], description: 'Random video' },
      { combos: [['S']], description: 'Play next similar video' },
      { combos: [['N']], description: 'Next (follows autoplay mode)' },
      { combos: [['A']], description: 'Toggle autoplay on / off' },
      { combos: [['M']], description: 'Cycle autoplay mode' },
    ],
  },
]
</script>

<template>
  <UModal :open="open" title="Keyboard Shortcuts" @update:open="$emit('update:open', $event)">
    <template #body>
      <div class="flex flex-col gap-6">
        <div v-for="section in sections" :key="section.title">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            {{ section.title }}
          </p>
          <div class="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            <div
              v-for="row in section.rows"
              :key="row.description"
              class="flex items-center justify-between gap-4 py-2"
            >
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ row.description }}</span>
              <div class="flex items-center gap-2 shrink-0">
                <template v-for="(combo, ci) in row.combos" :key="ci">
                  <span v-if="ci > 0" class="text-xs text-gray-400">or</span>
                  <span class="flex items-center gap-0.5">
                    <UKbd v-for="key in combo" :key="key">{{ key }}</UKbd>
                  </span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
