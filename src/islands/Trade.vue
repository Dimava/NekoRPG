<script setup vapor>
import { computed, ref } from 'vue'
import { t } from 'game/t'
import { format_money, update_displayed_character_inventory } from 'game/display'
import { current_game_time } from 'game/game-time'
import { character } from 'game/character'
import { traders } from 'game/traders'
import {
  trade_state, to_buy, to_sell,
  add_to_buying_list, remove_from_selling_list,
  accept_trade, cancel_trade, exit_trade,
} from 'game/trade'
import { round_item_price } from 'game/misc'
import Tooltip from '../components/Tooltip.vue'
import ItemTooltip from '../components/ItemTooltip.vue'
import Tabs from '../components/Tabs.vue'
import ItemTable from '../components/ItemTable.vue'
import { useHostVisibility } from '../components/useHostVisibility.js'


const root = ref(null)
const open = computed(() => !!trade_state.current_trader)
useHostVisibility(root, open, 'grid')

const trader = computed(() => trade_state.current_trader ? traders[trade_state.current_trader] : null)

const margin = computed(() => trader.value ? trader.value.getProfitMargin() : 1)

const cost_mult = computed(() => Math.round(100 * margin.value) + '%')

const refresh = computed(() => {
  if (!trader.value) return 'N/A'
  const days = trader.value.refresh_time - current_game_time.day_count + trader.value.last_refresh
  if (days <= 1e12) return Math.round(days) + 'd'
  return 'N/A'
})

const total = computed(() => to_sell.value - to_buy.value)

const can_afford = computed(() => character.money + total.value >= 0)

function bought_count(key) {
  for (const entry of to_buy.items) {
    if (entry.item_key === key) return Number(entry.count)
  }
  return 0
}

function matches_filter(item) {
  const filter = trade_state.category || 'all'
  if (filter === 'all') return true
  if (filter === 'equipment') return !!item.tags?.equippable
  if (filter === 'usable') return item.item_type === 'USABLE' || item.item_type === 'BOOK' || item.tags?.book
  if (filter === 'other') return !item.tags?.equippable && item.item_type !== 'USABLE' && item.item_type !== 'BOOK'
  return true
}

const rows = computed(() => {
  trade_state.pulse
  const tdr = trader.value
  if (!tdr) return []
  const out = []
  for (const key of Object.keys(tdr.inventory)) {
    const entry = tdr.inventory[key]
    let count = entry.count - bought_count(key)
    if (count <= 0) continue
    out.push({ kind: 'stock', key, item: entry.item, count, trade: false })
  }
  for (const entry of to_sell.items) {
    const inv = character.inventory[entry.item_key]
    if (!inv) continue
    out.push({ kind: 'sell', key: 'sell:' + entry.item_key, item_key: entry.item_key, item: inv.item, count: entry.count, trade: true })
  }
  const plus = (trade_state.sort_dir || 'asc') === 'asc' ? -1 : 1
  const minus = -plus
  const sort_by = trade_state.sort_by || 'price'
  out.sort((a, b) => {
    if (a.trade && !b.trade) return 1
    if (!a.trade && b.trade) return -1
    const ae = !!a.item.tags?.equippable
    const be = !!b.item.tags?.equippable
    if (ae && !be) return 1
    if (!ae && be) return -1
    if (sort_by === 'name') {
      const na = (a.item.getDisplayName?.() || '').toLowerCase()
      const nb = (b.item.getDisplayName?.() || '').toLowerCase()
      if (na !== nb) return na > nb ? plus : minus
      return (a.item.quality || 0) > (b.item.quality || 0) ? plus : minus
    }
    const va = a.item.getValue?.() ?? 0
    const vb = b.item.getValue?.() ?? 0
    if (va !== vb) return va > vb ? plus : minus
    return (a.item.quality || 0) > (b.item.quality || 0) ? plus : minus
  })
  return out
})

function row_attrs(row) {
  return {
    'data-trader_item': inventory_key(row),
    'data-item_count': row.count,
    'data-item_value': row.item.getValue(),
  }
}

function hide_row(row) {
  return !matches_filter(row.item)
}

function row_classes(row) {
  return [
    'inventory_item_control',
    'trader_item_control',
    row.item.tags?.equippable ? 'trader_item_equippable' : '',
    'trader_item_' + row.item.item_type.toLowerCase(),
    row.trade ? 'item_to_trade' : '',
  ]
}
function price_html(row) {
  const mult = row.trade ? 1 : margin.value
  return format_money(round_item_price(row.item.getValue() * mult), true)
}

function inventory_key(row) {
  return row.kind === 'sell' ? row.item_key : row.key
}

function sort_by(by) {
  if (by === trade_state.sort_by) {
    trade_state.sort_dir = trade_state.sort_dir === 'asc' ? 'desc' : 'asc'
  } else if (by === 'name') {
    trade_state.sort_dir = 'desc'
  } else {
    trade_state.sort_dir = 'asc'
  }
  trade_state.sort_by = by
}

function set_filter(filter) {
  trade_state.category = filter
}

function trade_click(row, count = 1) {
  const key = inventory_key(row)
  if (row.trade) remove_from_selling_list({ item_key: key, count })
  else add_to_buying_list({ item_key: key, count })
  update_displayed_character_inventory()
}

function on_exit() {
  exit_trade()
}

function on_cancel() {
  cancel_trade()
}

function on_accept() {
  if (!can_afford.value) return
  accept_trade()
}
</script>

<template>
  <span ref="root" hidden></span>
  <Tabs id="trader_sorting_buttons" class="tabs-sm" edge="top" role="tablist">
    <button
      id="trader_sort_by_price"
      type="button"
      role="tab"
      class="tab"
      :aria-selected="(trade_state.sort_by || 'price') === 'price'"
      :class="{ 'tab-active': (trade_state.sort_by || 'price') === 'price', active_selection_button: (trade_state.sort_by || 'price') === 'price' }"
      @click="sort_by('price')"
    >{{ t('按价值排序') }}</button>
    <button
      id="trader_sort_by_name"
      type="button"
      role="tab"
      class="tab"
      :aria-selected="trade_state.sort_by === 'name'"
      :class="{ 'tab-active': trade_state.sort_by === 'name', active_selection_button: trade_state.sort_by === 'name' }"
      @click="sort_by('name')"
    >{{ t('按名称排序') }}</button>
  </Tabs>
  <Tabs id="trader_category_buttons" class="tabs-sm" edge="top" role="tablist">
    <button
      id="trader_category_all"
      type="button"
      role="tab"
      class="tab"
      :aria-selected="(trade_state.category || 'all') === 'all'"
      :class="{ 'tab-active': (trade_state.category || 'all') === 'all', active_selection_button: (trade_state.category || 'all') === 'all' }"
      @click="set_filter('all')"
    >{{ t('全部') }}</button>
    <button
      id="trader_category_equipment"
      type="button"
      role="tab"
      class="tab"
      :aria-selected="trade_state.category === 'equipment'"
      :class="{ 'tab-active': trade_state.category === 'equipment', active_selection_button: trade_state.category === 'equipment' }"
      @click="set_filter('equipment')"
    >{{ t('装备') }}</button>
    <button
      id="trader_category_usable"
      type="button"
      role="tab"
      class="tab"
      :aria-selected="trade_state.category === 'usable'"
      :class="{ 'tab-active': trade_state.category === 'usable', active_selection_button: trade_state.category === 'usable' }"
      @click="set_filter('usable')"
    >{{ t('消耗品') }}</button>
    <button
      id="trader_category_other"
      type="button"
      role="tab"
      class="tab"
      :aria-selected="trade_state.category === 'other'"
      :class="{ 'tab-active': trade_state.category === 'other', active_selection_button: trade_state.category === 'other' }"
      @click="set_filter('other')"
    >{{ t('杂项') }}</button>
  </Tabs>
  <ItemTable
    id="trader_inventory_div"
    :rows="rows"
    :hide="hide_row"
    :row-class="row_classes"
    :row-attrs="row_attrs"
    @row-click="(row) => trade_click(row, 1)"
  >
    <template #buttons="{ row }">
      <div class="item_additional_content">
        <div class="trade_ammount_buttons">
          <div class="trade_ammount_button" @click.stop="trade_click(row, 10)">10</div>
          <div class="trade_ammount_button" @click.stop="trade_click(row, 100)">100</div>
          <div class="trade_ammount_button" @click.stop="trade_click(row, 1000)">1k</div>
          <div class="trade_ammount_button" @click.stop="trade_click(row, Infinity)">all</div>
        </div>
      </div>
    </template>
    <template #right="{ row }">
      <span class="item_value item_controls" v-html="price_html(row)"></span>
    </template>
    <template #tooltip="{ row }">
      <Tooltip :width="200">
        <template #content>
          <ItemTooltip :item="row.item" :options="{ trader: true }" />
        </template>
      </Tooltip>
    </template>
  </ItemTable>
  <div id="trade_control_div" class="flex flex-col">
    <div class="trade-stats">
      <div id="trader_cost_mult" class="flex items-center justify-between">
        <span>{{ t('价格:') }}</span>
        <span>{{ cost_mult }}</span>
      </div>
      <div id="trade_price_div" class="flex items-center justify-between">
        <span>{{ t('总计:') }}</span>
        <span v-html="format_money(total)"></span>
      </div>
      <div id="trade_time_div" class="flex items-center justify-between">
        <span>{{ t('刷新:') }}</span>
        <span>{{ refresh }}</span>
      </div>
    </div>
    <Tabs>
      <button
        id="accept_trade_button"
        type="button"
        :style="{ cursor: can_afford ? 'pointer' : 'no-drop', backgroundColor: can_afford ? 'green' : 'rgba(0, 128, 0, 0.3)' }"
        @click="on_accept"
      >{{ t('交易') }}</button>
      <button id="cancel_trade_button" type="button" @click="on_cancel">{{ t('取消') }}</button>
    </Tabs>
    <Tabs>
      <button id="exit_trade_button" type="button" @click="on_exit">{{ t('离开') }}</button>
    </Tabs>
  </div>
</template>

<style scoped>
#accept_trade_button,
#cancel_trade_button {
  float: none;
  width: auto;
  margin: 0;
  outline: none;
}
#cancel_trade_button { background-color: #c23030; }
#exit_trade_button {
  float: none;
  width: auto;
  margin: 0;
  outline: none;
  border: 0 solid white;
  border-top-width: 1px;
}
.trade-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(min-content, 1fr));
  width: 100%;
  box-sizing: border-box;
  font-size: 14px;
}
#trader_cost_mult,
#trade_price_div,
#trade_time_div {
  float: none;
  width: auto;
  margin: 0;
  outline: none;
  box-sizing: border-box;
  overflow: visible;
  white-space: nowrap;
  border: 0 solid white;
  border-top-width: 1px;
  border-left-width: 1px;
  padding: 1px 6px;
}
#trader_cost_mult {
  border-left-width: 0;
}
#trader_sorting_buttons.tabs-sm {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
#trader_category_buttons.tabs-sm {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
</style>
