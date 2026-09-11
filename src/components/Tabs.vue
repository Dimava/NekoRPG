<script setup vapor>
const props = defineProps({
  modelValue: { default: undefined },
  items: { type: Array, default: undefined },
  edge: { type: String, default: 'bottom' },
})
const emit = defineEmits(['update:modelValue'])

function pick(item) {
  if (item.disabled) return
  emit('update:modelValue', item.id)
}
</script>

<template>
  <div class="tabs" :class="edge === 'top' ? 'tabs-top' : 'tabs-bottom'">
    <template v-if="items?.length">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        :disabled="!!item.disabled"
        :class="{ active_selection_button: modelValue === item.id }"
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
.tabs > button {
  appearance: none;
  cursor: pointer;
  padding: 3px 2px;
  font: inherit;
  font-size: 16px;
}
.tabs > button:hover,
.tabs > button.active_selection_button {
  background-color: var(--active_button_color);
}
.tabs > button:disabled {
  pointer-events: none;
  cursor: default;
  color: gray;
}
</style>
