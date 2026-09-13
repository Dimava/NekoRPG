<script>
const hosts = new Map()
const cursor = { x: 0, y: 0 }
const HIDE_MS = 60
let active = null
let hide_timer = 0
let frame = 0
let mounted = 0

function host_at_point() {
  const el = document.elementFromPoint(cursor.x, cursor.y)
  return el?.closest?.('[data-has-tooltip]') ?? null
}

function on_pointer(event) {
  cursor.x = event.clientX
  cursor.y = event.clientY
  retarget()
}

function on_scroll() {
  retarget()
}

function on_resize() {
  active?.place()
}

function on_key(event) {
  if (event.key !== 'Escape' || !active) return
  cancel_hide()
  active.conceal()
  active = null
}

function listen() {
  if (mounted++) return
  window.addEventListener('pointermove', on_pointer, { passive: true })
  window.addEventListener('scroll', on_scroll, true)
  window.addEventListener('resize', on_resize)
  window.addEventListener('keydown', on_key)
  document.documentElement.addEventListener('mouseleave', schedule_hide)
}

function unlisten() {
  if (--mounted) return
  mounted = 0
  cancel_hide()
  if (frame) {
    cancelAnimationFrame(frame)
    frame = 0
  }
  window.removeEventListener('pointermove', on_pointer)
  window.removeEventListener('scroll', on_scroll, true)
  window.removeEventListener('resize', on_resize)
  window.removeEventListener('keydown', on_key)
  document.documentElement.removeEventListener('mouseleave', schedule_hide)
}

function cancel_hide() {
  if (!hide_timer) return
  clearTimeout(hide_timer)
  hide_timer = 0
}

function schedule_hide() {
  if (!active || hide_timer) return
  hide_timer = setTimeout(() => {
    hide_timer = 0
    if (host_at_point()) return
    active?.conceal()
    active = null
  }, HIDE_MS)
}

function activate(api, via) {
  cancel_hide()
  if (active === api) {
    api.via = via
    api.place()
    return
  }
  const prev = active
  active = api
  api.via = via
  api.reveal().then(() => {
    if (prev && prev !== active) prev.conceal()
  })
}

function retarget() {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    const host = host_at_point()
    const next = host && hosts.get(host)
    if (next) activate(next, 'pointer')
    else if (active?.via !== 'focus') schedule_hide()
  })
}

function register(host, api) {
  hosts.set(host, api)
  host.dataset.hasTooltip = 'true'
  listen()
}

function unregister(host, api) {
  hosts.delete(host)
  delete host.dataset.hasTooltip
  if (active === api) {
    cancel_hide()
    api.conceal()
    active = null
  }
  unlisten()
}
</script>

<script setup vapor>
import { nextTick, onMounted, onScopeDispose, ref, watch } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  width: { type: Number, default: 200 },
  gap: { type: Number, default: 6 },
  align: { type: String, default: 'start' },
})

const id = `vapor-tooltip-${crypto.randomUUID()}`
const anchor = ref()
const bubble = ref()
const shown = ref(false)
const placed = ref(false)
const left = ref(0)
const top = ref(0)

let host = null
let flipped = false

// The arrow cursor's hotspot is its tip, so the glyph only ever covers pixels
// down and to the right of the reported coordinate.
const cursor_glyph = { x: 14, y: 20 }

function place() {
  if (!shown.value || !bubble.value) return

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

  // Once forced below the cursor, stay there until the next reveal, or the
  // bubble oscillates as the pointer crosses the threshold.
  flipped ||= y - height - props.gap < margin
  const nextTop = flipped ? y + cursor_glyph.y + props.gap : y - height - props.gap

  left.value = Math.round(Math.max(margin, Math.min(nextLeft, window.innerWidth - width - margin)))
  top.value = Math.round(Math.max(margin, Math.min(nextTop, window.innerHeight - height - margin)))
}

function teleport() {
  const el = bubble.value
  if (el && el.parentElement !== document.body) document.body.appendChild(el)
}

const api = {
  via: 'pointer',
  place,
  reveal() {
    if (props.disabled) return Promise.resolve()
    flipped = false
    shown.value = true
    teleport()
    host?.setAttribute('aria-describedby', id)
    return nextTick().then(() => {
      place()
      placed.value = true
    })
  },
  conceal() {
    shown.value = false
    placed.value = false
    host?.removeAttribute('aria-describedby')
  },
}

function on_focusin() {
  if (props.disabled || !host) return
  // Click focuses the host (tabIndex=0). Keep the pointer-driven position
  // instead of snapping the bubble to the row's top-left.
  if (host_at_point() === host) {
    if (active !== api) activate(api, 'pointer')
    return
  }
  const rect = host.getBoundingClientRect()
  cursor.x = rect.left
  cursor.y = rect.top
  activate(api, 'focus')
}

function on_focusout() {
  if (active === api) schedule_hide()
}

function attach() {
  if (!host || props.disabled) return
  register(host, api)
  if (!host.hasAttribute('tabindex')) host.tabIndex = 0
  host.addEventListener('focusin', on_focusin)
  host.addEventListener('focusout', on_focusout)
}

function detach() {
  if (!host) return
  host.removeEventListener('focusin', on_focusin)
  host.removeEventListener('focusout', on_focusout)
  unregister(host, api)
}

onMounted(() => {
  host = anchor.value.parentElement
  teleport()
  attach()
})

watch(() => props.disabled, disabled => {
  if (disabled) detach()
  else attach()
})

onScopeDispose(() => {
  detach()
  bubble.value?.remove()
})
</script>

<template>
  <span ref="anchor" hidden />

  <div
    :id="id"
    ref="bubble"
    role="tooltip"
    class="pointer-events-none fixed z-1000 box-border rounded-[10px] border border-solid border-white bg-tooltip p-1.5 text-left text-[16px] font-normal text-white shadow-lg"
    :style="{
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      visibility: shown && placed ? 'visible' : 'hidden',
    }"
  >
    <slot name="content" />
  </div>
</template>
