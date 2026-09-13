<script setup vapor>
import { t } from 'game/t'
import { book_stats } from 'game/items'

const SLOT = {
  sword: '剑', head: '头部', trident: '三叉戟', moonwheel: '月轮', torso: '躯干',
  legs: '腿部', feet: '脚部', weapon: '武器', props: '道具', method: '秘法',
  special: '特殊', realm: '领域', law: '法则',
}

const props = defineProps({
  item: { type: Object, required: true },
  count: { type: Number, default: 1 },
})

function rarity() {
  return props.item.getRarity ? 'rarity_' + props.item.getRarity() : ''
}

function book_finished() {
  return !!(props.item.tags?.book || props.item.item_type === 'BOOK') && book_stats[props.item.name]?.is_finished
}

function display_name() {
  return t(props.item.getDisplayName?.() ?? props.item.name)
}
</script>

<template>
  <div class="item-table-row">
    <div class="item-table-main">
      <div
        class="inventory_item character_item"
        :class="[
          item.tags?.equippable ? 'item_equippable' : '',
          item.tags?.component ? 'item_component' : '',
          (item.tags?.book || item.item_type === 'BOOK') ? 'item_book' : '',
          item.item_type ? 'item_' + item.item_type.toLowerCase() : '',
          book_finished() ? 'book_finished' : '',
        ]"
      >
        <div class="inventory_item_name">
          <template v-if="item.tags?.tool">
            <span class="item_slot">{{ t('[tool]') }}</span>
            <span>{{ display_name() }}</span>
          </template>
          <template v-else-if="item.tags?.equippable">
            <span class="item_slot">[{{ t(SLOT[item.equip_slot] || item.equip_slot) }}]</span>
            <span :class="rarity()">{{ display_name() }}</span>
          </template>
          <template v-else-if="item.tags?.component">
            <span class="item_category">[{{ t('部件') }}]</span>
            <span class="item_name"><span :class="rarity()">{{ display_name() }}</span></span>
          </template>
          <template v-else-if="item.tags?.book || item.item_type === 'BOOK'">
            <span class="item_category">{{ t('[Book]') }}</span>
            <span class="book_name item_name">"{{ display_name() }}"</span>
          </template>
          <template v-else>
            <span v-if="item.image" class="item_image"><img :src="item.image"></span>
            <span class="item_category"></span>
            <span class="item_name">{{ display_name() }}</span>
          </template>
          <span class="item_count">{{ count != 1 ? ' x' + count : '' }}</span>
        </div>
      </div>
    </div>
    <div class="item-table-actions">
      <slot name="buttons" />
    </div>
    <div class="item-table-end">
      <slot name="right" />
    </div>
    <slot name="tooltip" />
  </div>
</template>

<style scoped>
.item-table-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto var(--item-table-bar, 80px);
  align-items: stretch;
  box-sizing: border-box;
  width: 100%;
  border-bottom: 1px dotted white;
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
