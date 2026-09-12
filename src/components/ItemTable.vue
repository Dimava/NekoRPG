<script setup vapor>
defineProps({
  /** Right-column width. Vertical bar sits on this edge. */
  bar: { type: String, default: '80px' },
})
</script>

<template>
  <div class="item-table" :style="{ '--item-table-bar': bar }">
    <slot />
  </div>
</template>
