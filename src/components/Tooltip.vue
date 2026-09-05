<script setup vapor>
import { nextTick, onMounted, onScopeDispose, ref } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  width: { type: Number, default: 200 },
  gap: { type: Number, default: 6 },
  align: { type: String, default: 'start' },
})

const id = `vapor-tooltip-${crypto.randomUUID()}`
const anchor = ref()
const bubble = ref()
const visible = ref(false)
const left = ref(0)
const top = ref(0)
const cursor = { x: 0, y: 0 }
let host = null
let listening = false
let flipped = false
let frame = 0

// The arrow cursor's hotspot is its tip, so the glyph only ever covers pixels
// down and to the right of the reported coordinate.
const cursor_glyph = { x: 14, y: 20 }

function place() {
  if (!visible.value || !bubble.value) return

  const margin = 8
  const { width, height } = bubble.value.getBoundingClientRect()
  const { x, y } = cursor
  let nextLeft

  if (props.align === 'end') {
    nextLeft = x - width
  } else if (props.align === 'center') {
    nextLeft = x - width / 2
  } else {
    nextLeft = x + cursor_glyph.x
  }

  // Once forced below the cursor, stay there until the next show(), or the
  // bubble oscillates as the pointer crosses the threshold.
  flipped ||= y - height - props.gap < margin
  const nextTop = flipped ? y + cursor_glyph.y + props.gap : y - height - props.gap

  left.value = Math.round(Math.max(margin, Math.min(nextLeft, window.innerWidth - width - margin)))
  top.value = Math.round(Math.max(margin, Math.min(nextTop, window.innerHeight - height - margin)))
}

function track(event) {
  cursor.x = event.clientX
  cursor.y = event.clientY
  if (!visible.value || frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    place()
  })
}

function listen() {
  if (listening) return
  listening = true
  window.addEventListener('resize', place)
  window.addEventListener('scroll', place, true)
}

function unlisten() {
  if (frame) {
    cancelAnimationFrame(frame)
    frame = 0
  }
  if (!listening) return
  listening = false
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', place, true)
}

async function show(event) {
  if (props.disabled) return
  flipped = false
  if (event?.clientX !== undefined) {
    cursor.x = event.clientX
    cursor.y = event.clientY
  } else {
    const rect = host.getBoundingClientRect()
    cursor.x = rect.left
    cursor.y = rect.top
  }
  visible.value = true
  host.setAttribute('aria-describedby', id)
  listen()
  await nextTick()
  place()
}

function hide() {
  visible.value = false
  host.removeAttribute('aria-describedby')
  unlisten()
}

function onKeydown(event) {
  if (event.key === 'Escape') hide()
}

const events = [['mouseenter', show], ['mousemove', track], ['mouseleave', hide], ['focusin', show], ['focusout', hide], ['keydown', onKeydown]]

onMounted(() => {
  host = anchor.value.parentElement
  if (!host.hasAttribute('tabindex')) host.tabIndex = 0
  host.dataset.hasTooltip = 'true'
  for (const [name, handler] of events) host.addEventListener(name, handler)
})

onScopeDispose(() => {
  unlisten()
  if (host) delete host.dataset.hasTooltip
  for (const [name, handler] of events) host?.removeEventListener(name, handler)
})
</script>

<template>
  <span ref="anchor" hidden />

  <div
    v-if="visible"
    :id="id"
    ref="bubble"
    role="tooltip"
    class="pointer-events-none fixed z-1000 box-border rounded-[10px] border border-solid border-white bg-tooltip p-1.5 text-left text-[16px] font-normal text-white shadow-lg"
    :style="{ left: `${left}px`, top: `${top}px`, width: `${width}px` }"
  >
    <slot name="content" />
  </div>
</template>
