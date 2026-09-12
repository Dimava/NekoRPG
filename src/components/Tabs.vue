<script setup vapor>
const props = defineProps({
  modelValue: { default: undefined },
  inverted: { type: Boolean, default: false },
  items: { type: Array, default: undefined },
  edge: { type: String, default: 'bottom' },
  /** xs 14/6px, sm 16/0, md 16/3px 2px, lg 20/3px 2px — match live heights */
  size: { type: String, default: 'md' },
  bold: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'update:inverted'])

function pick(item) {
  if (item.disabled) return
  if (item.id === props.modelValue) {
    emit('update:inverted', !props.inverted)
    return
  }
  emit('update:modelValue', item.id)
}
</script>

<template>
  <div
    class="tabs"
    :class="[`tabs-${size}`, edge === 'top' ? 'tabs-top' : 'tabs-bottom', bold && 'tabs-bold']"
    :style="items?.length ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined"
  >
    <template v-if="items?.length">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="tab"
        :disabled="!!item.disabled"
        :class="{ active_selection_button: modelValue === item.id, 'tab-active': modelValue === item.id }"
        @click="pick(item)"
      >{{ item.label }}</button>
    </template>
    <slot v-else />
  </div>
</template>

<style scoped>
.tabs {
  grid-column: 1 / -1;
  display: grid;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  font-size: var(--tab-fs);
  font-weight: var(--tab-fw);
  line-height: normal;
}
.tabs-xs { --tab-fs: 14px; --tab-p: 6px; --tab-fw: 400; }
.tabs-sm { --tab-fs: 16px; --tab-p: 0px; --tab-fw: 400; }
.tabs-md { --tab-fs: 16px; --tab-p: 3px 2px; --tab-fw: 400; }
.tabs-lg { --tab-fs: 20px; --tab-p: 3px 2px; --tab-fw: 400; }
.tabs-bold { --tab-fw: 700; }
.tabs > * {
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  margin: 0;
  border: 0 solid white;
  border-left-width: 1px;
  text-align: center;
  color: inherit;
  background: transparent;
  overflow: hidden;
}
.tabs > :first-child {
  border-left-width: 0;
}
.tabs-top > * {
  border-bottom-width: 1px;
}
.tabs-bottom > * {
  border-top-width: 1px;
}
.tabs > button,
.tabs > :deep(button) {
  appearance: none;
  cursor: pointer;
  padding: var(--tab-p);
  font: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  white-space: nowrap;
}
.tabs > .tab:hover:not(:disabled):not(.tab-active):not(.active_selection_button),
.tabs > :deep(.tab:hover:not(:disabled):not(.tab-active):not(.active_selection_button)) {
  background-color: color-mix(in srgb, var(--active_button_color) 30%, transparent);
}
.tabs > button.tab-active,
.tabs > button.active_selection_button,
.tabs > :deep(button.tab-active),
.tabs > :deep(button.active_selection_button) {
  background-color: var(--active_button_color);
}
.tabs > .tab.tab-active:hover:not(:disabled),
.tabs > .tab.active_selection_button:hover:not(:disabled),
.tabs > :deep(.tab.tab-active:hover:not(:disabled)),
.tabs > :deep(.tab.active_selection_button:hover:not(:disabled)) {
  background-color: color-mix(in srgb, var(--active_button_color) 75%, white);
}
.tabs > button:disabled,
.tabs > :deep(button:disabled) {
  pointer-events: none;
  cursor: default;
  color: gray;
}
</style>
