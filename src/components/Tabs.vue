<script setup vapor>
const props = defineProps({
  modelValue: { default: undefined },
  inverted: { type: Boolean, default: false },
  items: { type: Array, default: undefined },
  edge: { type: String, default: 'bottom' },
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
  <div class="tabs tabs-sm" :class="edge === 'top' ? 'tabs-top' : 'tabs-bottom'">
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
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  font-size: 13px;
  line-height: 1.2;
}
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
  padding: 2px 4px;
  font: inherit;
  font-size: 13px;
  line-height: 1.2;
  white-space: nowrap;
}
.tabs > button:hover,
.tabs > button.active_selection_button,
.tabs > button.tab-active,
.tabs > :deep(button:hover),
.tabs > :deep(button.active_selection_button),
.tabs > :deep(button.tab-active) {
  background-color: var(--active_button_color);
}
.tabs > button.tab-active,
.tabs > button.active_selection_button {
  font-weight: 600;
}
.tabs > button:disabled,
.tabs > :deep(button:disabled) {
  pointer-events: none;
  cursor: default;
  color: gray;
}
</style>
