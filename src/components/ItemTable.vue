<script setup vapor>
import ItemTableRow from './ItemTableRow.vue'

defineProps({
  rows: { type: Array, required: true },
  /** Right-column width. Vertical bar sits on this edge. */
  bar: { type: String, default: '80px' },
  rowKey: { type: Function, default: row => row.key },
  rowClass: { type: Function, default: () => [] },
  rowAttrs: { type: Function, default: () => ({}) },
  hide: { type: Function, default: () => false },
})

defineEmits(['rowClick'])
</script>

<template>
  <div class="item-table" :style="{ '--item-table-bar': bar }">
    <ItemTableRow
      v-for="row in rows"
      :key="rowKey(row)"
      v-show="!hide(row)"
      :class="rowClass(row)"
      v-bind="rowAttrs(row)"
      :item="row.item"
      :count="row.count"
      @click="$emit('rowClick', row, $event)"
    >
      <template #buttons>
        <slot name="buttons" :row="row" />
      </template>
      <template #right>
        <slot name="right" :row="row" />
      </template>
      <template #tooltip>
        <slot name="tooltip" :row="row" />
      </template>
    </ItemTableRow>
  </div>
</template>
