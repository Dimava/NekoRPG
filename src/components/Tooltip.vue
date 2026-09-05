<script setup vapor>
import { nextTick, onScopeDispose, ref } from 'vue'

const props = defineProps({
  content: { type: String, default: '' },
  html: { type: Boolean, default: false },
  width: { type: Number, default: 200 },
  gap: { type: Number, default: 6 },
  align: { type: String, default: 'start' },
})

const id = `vapor-tooltip-${crypto.randomUUID()}`
const trigger = ref()
const bubble = ref()
const visible = ref(false)
const left = ref(0)
const top = ref(0)
let listening = false

function place() {
  if (!visible.value || !trigger.value || !bubble.value) return

  const margin = 8
  const triggerRect = trigger.value.getBoundingClientRect()
  const bubbleRect = bubble.value.getBoundingClientRect()
  let nextLeft

  if (props.align === 'end') {
    nextLeft = triggerRect.right - bubbleRect.width
  } else if (props.align === 'center') {
    nextLeft = triggerRect.left + (triggerRect.width - bubbleRect.width) / 2
  } else {
    nextLeft = triggerRect.left
  }

  nextLeft = Math.max(margin, Math.min(nextLeft, window.innerWidth - bubbleRect.width - margin))

  let nextTop = triggerRect.bottom + props.gap
  if (nextTop + bubbleRect.height > window.innerHeight - margin) {
    nextTop = triggerRect.top - bubbleRect.height - props.gap
  }
  nextTop = Math.max(margin, Math.min(nextTop, window.innerHeight - bubbleRect.height - margin))

  left.value = Math.round(nextLeft)
  top.value = Math.round(nextTop)
}

function listen() {
  if (listening) return
  listening = true
  window.addEventListener('resize', place)
  window.addEventListener('scroll', place, true)
}

function unlisten() {
  if (!listening) return
  listening = false
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', place, true)
}

async function show() {
  if (!props.content) return
  visible.value = true
  listen()
  await nextTick()
  place()
}

function hide() {
  visible.value = false
  unlisten()
}

onScopeDispose(unlisten)
</script>

<template>
  <span
    ref="trigger"
    class="inline-block"
    tabindex="0"
    :aria-describedby="visible ? id : undefined"
    @mouseenter="show"
    @mouseleave="hide"
    @focus="show"
    @blur="hide"
    @keydown.escape="hide"
  >
    <slot />
  </span>

  <div
    v-if="visible"
    :id="id"
    ref="bubble"
    role="tooltip"
    class="pointer-events-none fixed z-1000 box-border rounded-[10px] border border-white bg-tooltip p-1.5 text-left text-[16px] font-normal text-white shadow-lg"
    :style="{ left: `${left}px`, top: `${top}px`, width: `${width}px` }"
  >
    <div v-if="html" v-html="content" />
    <div v-else>{{ content }}</div>
  </div>
</template>
