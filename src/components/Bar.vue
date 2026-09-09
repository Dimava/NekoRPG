<script setup vapor>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  max: { type: Number, default: 1 },
  fill: { type: String, default: 'orange' },
  track: { type: String, default: 'rgba(255, 165, 0, 0.3)' },
  outline: { type: String, default: 'rgb(255, 126, 0)' },
  height: { type: Number, default: 16 },
})

const percent = computed(() => {
  if (!(props.max > 0)) return 0
  return Math.max(0, Math.min(100, (100 * props.value) / props.max))
})
</script>

<template>
  <div class="grid w-full items-center justify-items-center" :style="{ height: `${height}px` }">
    <div class="col-start-1 row-start-1 h-full w-full" :style="{ outline: `2px solid ${outline}`, backgroundColor: track }">
      <div class="h-full" :style="{ width: `${percent}%`, backgroundColor: fill }"></div>
    </div>
    <div class="col-start-1 row-start-1 w-full text-center text-[18px] leading-5 text-white">
      <slot />
    </div>
  </div>
</template>
