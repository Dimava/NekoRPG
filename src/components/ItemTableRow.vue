<script setup vapor>
</script>

<template>
  <div class="item-table-row">
    <div class="item-table-main">
      <slot />
    </div>
    <div class="item-table-actions">
      <slot name="actions" />
    </div>
    <div class="item-table-end">
      <slot name="end" />
    </div>
    <slot name="tooltip" />
  </div>
</template>

<style scoped>
.item-table-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto var(--item-table-bar, 80px);
  align-items: center;
  box-sizing: border-box;
  width: 100%;
}
.item-table-main {
  min-width: 0;
}
.item-table-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}
.item-table-end {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  height: 100%;
  border-left: 1px solid white;
  padding: 0 4px;
}
.item-table-end :deep(.item_value) {
  border-left: none;
  width: auto;
  padding-left: 0;
}
</style>
