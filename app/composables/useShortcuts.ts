export interface Shortcut {
  key: string
  meta?: boolean
  shift?: boolean
  allowInInput?: boolean
  handler: () => void
}

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
    || (el as HTMLElement).isContentEditable
}

export function useShortcuts(shortcuts: Shortcut[]) {
  function onKeydown(e: KeyboardEvent) {
    for (const shortcut of shortcuts) {
      if (!shortcut.allowInInput && isInputFocused()) continue
      if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) continue
      if (shortcut.meta && !(e.metaKey || e.ctrlKey)) continue
      if (!shortcut.meta && (e.metaKey || e.ctrlKey)) continue
      if (e.shiftKey !== (shortcut.shift ?? false)) continue
      e.preventDefault()
      shortcut.handler()
      break
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
