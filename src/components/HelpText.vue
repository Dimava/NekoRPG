<script setup vapor>
import { computed } from 'vue'
import { t, tx } from 'game/t'
import Rich from './Rich.vue'

// One piece of help_content.js, translated and rendered through Rich.
const props = defineProps({ value: { default: null } })

function part(p) {
  if (typeof p === 'string') return t(p)
  if ('del' in p) return { tag: 'del', children: [t(p.del)] }
  if ('img' in p) return { tag: 'img', src: p.img, cls: 'help_icon' }
  if ('key' in p) return tx(p.key.split('{{}}'), ...p.parts.map(part))
  return { ...p, text: t(p.text) }
}

function to_rich(value) {
  if (value == null) return null
  if (Array.isArray(value)) return value.flatMap((v, i) => (i ? [{ br: true }, to_rich(v)] : [to_rich(v)]))
  return part(value)
}

const rich = computed(() => to_rich(props.value))
</script>

<template>
  <Rich :value="rich" />
</template>
