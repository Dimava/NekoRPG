import { onMounted, watch } from 'vue'

export function useHostVisibility(root, visible, display = 'block') {
  const sync = () => {
    const host = root.value?.parentElement
    if (host) host.style.display = visible.value ? display : 'none'
  }
  watch(visible, sync, { flush: 'post' })
  onMounted(sync)
}
