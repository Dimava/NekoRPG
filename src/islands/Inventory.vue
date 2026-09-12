<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { character } from 'game/character'
import { format_money, inventory_panel, log_message, update_displayed_trader_inventory } from 'game/display'
import { character_equip_item, character_unequip_item, use_item, use_item_max, start_reading, get_current_book } from 'game/main'
import { to_buy, to_sell, trade_state, add_to_selling_list, remove_from_buying_list, is_in_trade } from 'game/trade'
import { traders } from 'game/traders'
import { book_stats } from 'game/items'
import { round_item_price } from 'game/misc'
import Tooltip from '../components/Tooltip.vue'
import ItemTooltip from '../components/ItemTooltip.vue'
import Tabs from '../components/Tabs.vue'
import ItemTable from '../components/ItemTable.vue'
import ItemTableRow from '../components/ItemTableRow.vue'

const SLOT = {
  sword: '剑', head: '头部', trident: '三叉戟', moonwheel: '月轮', torso: '躯干',
  legs: '腿部', feet: '脚部', weapon: '武器', props: '道具', method: '秘法',
  special: '特殊', realm: '领域', law: '法则',
}

const trading = computed(() => is_in_trade())
const sortInverted = computed({
  get: () => inventory_panel.direction === 'desc',
  set: v => { inventory_panel.direction = v ? 'desc' : 'asc' },
})

function sold_count(key) {
  for (const entry of to_sell.items) {
    if (entry.item_key === key) return Number(entry.count)
  }
  return 0
}

function matches_filter(item) {
  const filter = inventory_panel.filter
  if (filter === 'all') return true
  if (filter === 'equipment') return !!item.tags?.equippable
  if (filter === 'consumable') return item.item_type === 'USABLE' || item.item_type === 'BOOK' || item.tags?.book
  if (filter === 'loot') return item.item_type === 'LOOT'
  if (filter === 'other') return item.item_type === 'OTHER' || item.item_type === 'MATERIAL' || item.item_type === 'COMPONENT' || item.tags?.component
  return true
}

const rows = computed(() => {
  inventory_panel.book_pulse
  const out = []
  for (const slot of Object.keys(character.equipment)) {
    const item = character.equipment[slot]
    if (!item || item.tags?.tool) continue
    out.push({ kind: 'equipped', key: 'eq:' + slot, slot, item, count: 1, trade: false })
  }
  for (const key of Object.keys(character.inventory)) {
    const entry = character.inventory[key]
    if (!entry) continue
    let count = entry.count - sold_count(key)
    if (count <= 0) continue
    out.push({ kind: 'inv', key, slot: entry.item.equip_slot, item: entry.item, count, trade: false })
  }
  if (trade_state.current_trader) {
    const trader = traders[trade_state.current_trader]
    for (const entry of to_buy.items) {
      const inv = trader.inventory[entry.item_key]
      if (!inv) continue
      out.push({ kind: 'buy', key: 'buy:' + entry.item_key, item_key: entry.item_key, item: inv.item, count: entry.count, trade: true })
    }
  }
  const plus = inventory_panel.direction === 'asc' ? -1 : 1
  const minus = inventory_panel.direction === 'asc' ? 1 : -1
  out.sort((a, b) => {
    if (a.kind === 'equipped' && b.kind !== 'equipped') return -1
    if (a.kind !== 'equipped' && b.kind === 'equipped') return 1
    if (a.trade && !b.trade) return 1
    if (!a.trade && b.trade) return -1
    const ae = !!a.item.tags?.equippable
    const be = !!b.item.tags?.equippable
    if (ae && !be) return 1
    if (!ae && be) return -1
    const ac = !!a.item.tags?.component
    const bc = !!b.item.tags?.component
    if (ac && !bc) return 1
    if (!ac && bc) return -1
    const ab = !!a.item.tags?.book || a.item.item_type === 'BOOK'
    const bb = !!b.item.tags?.book || b.item.item_type === 'BOOK'
    if (ab && !bb) return 1
    if (!ab && bb) return -1
    if (inventory_panel.sort_by === 'name') {
      const na = (a.item.getDisplayName?.() || '').toLowerCase().replaceAll('"', '')
      const nb = (b.item.getDisplayName?.() || '').toLowerCase().replaceAll('"', '')
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

function row_classes(row) {
  const type = row.item.item_type.toLowerCase()
  const classes = [
    row.kind === 'equipped' ? 'equipped_item_control' : 'inventory_item_control',
    'character_item_control',
    'character_item_' + type,
  ]
  if (row.item.tags?.equippable) classes.push('character_item_equippable')
  if (row.item.tags?.component) classes.push('character_item_component')
  if (row.trade) classes.push('item_to_trade')
  if (row.item.tags?.book || row.item.item_type === 'BOOK') {
    if (get_current_book() === row.item.name) classes.push('book_active')
  }
  return classes
}

function book_finished(row) {
  return !!(row.item.tags?.book || row.item.item_type === 'BOOK') && book_stats[row.item.name]?.is_finished
}

function rarity(item) {
  return 'rarity_' + item.getRarity()
}

function price_html(row) {
  let multiplier = 1
  if (row.trade && trade_state.current_trader) {
    multiplier = traders[trade_state.current_trader].getProfitMargin() || 1
  }
  return format_money(round_item_price(row.item.getValue() * multiplier), true)
}

function inventory_key(row) {
  if (row.kind === 'buy') return row.item_key
  if (row.kind === 'equipped') return row.item.getInventoryKey()
  return row.key
}

function sort_by(by) {
  if (by === inventory_panel.sort_by) {
    inventory_panel.direction = inventory_panel.direction === 'asc' ? 'desc' : 'asc'
  } else if (by === 'name') {
    inventory_panel.direction = 'desc'
  } else {
    inventory_panel.direction = 'asc'
  }
  inventory_panel.sort_by = by
}

function set_filter(filter) {
  inventory_panel.filter = filter
}

function refresh_trade_price() {
  const total = to_sell.value - to_buy.value
  const price = document.getElementById('trade_price_value')
  if (price) price.innerHTML = format_money(total)
  const accept = document.getElementById('accept_trade_button')
  if (!accept) return
  if (character.money + total < 0) {
    accept.style.cursor = 'no-drop'
    accept.style.backgroundColor = 'rgba(0, 128, 0, 0.3)'
  } else {
    accept.style.cursor = 'pointer'
    accept.style.backgroundColor = 'green'
  }
}

function sell_peak_blocked(item_key) {
  if (item_key !== '{"id":"峰"}') return false
  const s = character.stats.full
  const chara_rank = (s.attack_mul || 1) * (s.attack_power + s.defense + s.agility) * s.attack_speed * (1 + (s.crit_multiplier - 1) * s.crit_rate)
  let lgrank = Math.log10(chara_rank)
  let lgresult = 0
  if (lgrank < 3.84) lgresult = 14 - 0.11 * lgrank ** 2
  else if (lgrank < 7.903) lgresult = 15.352 - 0.77 * lgrank
  else lgresult = 18.352 - 1.3 * lgrank + 0.019 * lgrank ** 2
  const chara_result = Math.round(Math.max(1, Math.pow(10, lgresult)))
  if (chara_result > 1) {
    log_message('[纱雪]哈?卖掉峰大哥?', 'sayuki')
    log_message('[纱雪]为了防止他把你揍死，帮你取消交易了哦~', 'sayuki')
    return true
  }
  log_message('[纱雪]虽然不知道都燕岗领第一了峰大哥怎么还在你身上……', 'sayuki')
  log_message('[纱雪]但是没关系！既然你那么努力，这些钱就给你了啦。', 'sayuki')
  return false
}

function trade_click(row, count = 1) {
  if (!trading.value) return
  if (row.kind === 'equipped') {
    console.warn("Can't sell equipped items")
    return
  }
  const key = inventory_key(row)
  if (row.trade) {
    remove_from_buying_list({ item_key: key, count })
  } else {
    if (sell_peak_blocked(key)) return
    add_to_selling_list({ item_key: key, count })
  }
  update_displayed_trader_inventory()
  refresh_trade_price()
}

function on_row_click(row) {
  if (trading.value) trade_click(row, 1)
}

function trade_amount(row, event, amount) {
  event.stopPropagation()
  trade_click(row, amount)
}
</script>

<template>
  <div id="money_div" v-html="t`你的钱包: ${format_money(character.money)}`"></div>
  <ItemTable id="inventory_content_div">
    <ItemTableRow
      v-for="row in rows"
      v-show="matches_filter(row.item)"
      :key="row.key"
      :class="row_classes(row)"
      :data-character_item="inventory_key(row)"
      :data-item_count="row.count"
      :data-item_value="row.item.getValue()"
      :data-item_quality="row.item.quality"
      :data-item_slot="row.item.equip_slot"
      @click="on_row_click(row)"
    >
      <div
        class="inventory_item character_item"
        :class="[
          row.item.tags?.equippable ? 'item_equippable' : '',
          row.item.tags?.component ? 'item_component' : '',
          (row.item.tags?.book || row.item.item_type === 'BOOK') ? 'item_book' : '',
          'item_' + row.item.item_type.toLowerCase(),
          book_finished(row) ? 'book_finished' : '',
        ]"
      >
        <div class="inventory_item_name">
          <template v-if="row.item.tags?.tool">
            <span class="item_slot">{{ t('[tool]') }}</span>
            <span>{{ t(row.item.getDisplayName()) }}</span>
          </template>
          <template v-else-if="row.item.tags?.equippable">
            <span class="item_slot">[{{ t(SLOT[row.item.equip_slot] || row.item.equip_slot) }}]</span>
            <span :class="rarity(row.item)">{{ t(row.item.getDisplayName()) }}</span>
          </template>
          <template v-else-if="row.item.tags?.component">
            <span class="item_category">[{{ t('部件') }}]</span>
            <span class="item_name"><span :class="rarity(row.item)">{{ t(row.item.getDisplayName()) }}</span></span>
          </template>
          <template v-else-if="row.item.tags?.book || row.item.item_type === 'BOOK'">
            <span class="item_category">{{ t('[Book]') }}</span>
            <span class="book_name item_name">"{{ t(row.item.getDisplayName()) }}"</span>
          </template>
          <template v-else>
            <span class="item_image"><img :src="row.item.image"></span>
            <span class="item_category"></span>
            <span class="item_name">{{ t(row.item.getDisplayName()) }}</span>
          </template>
          <span class="item_count">{{ row.count != 1 ? ' x' + row.count : '' }}</span>
        </div>
      </div>
      <template #actions>
        <div class="item_additional_content">
          <template v-if="!trading && row.kind !== 'buy'">
            <template v-if="row.item.item_type === 'USABLE'">
              <div class="item_use_button item_use_max" @click.stop="use_item_max(inventory_key(row))">{{ t('[Max]') }}</div>
              <div class="item_use_button item_use_10" @click.stop="Array.from({length:10}, () => use_item(inventory_key(row), false))">{{ t('[x10]') }}</div>
              <div class="item_use_button" @click.stop="use_item(inventory_key(row), false)">{{ t('[使用]') }}</div>
            </template>
            <div v-else-if="row.item.item_type === 'BOOK'" class="item_use_button" @click.stop="start_reading(inventory_key(row))">{{ t('[阅读]') }}</div>
            <span v-if="row.item.tags?.equippable && row.kind !== 'equipped'" class="equip_item_button item_controls" @click.stop="character_equip_item(inventory_key(row))">{{ t('[装备]') }}</span>
            <div v-if="row.kind === 'equipped'" class="unequip_item_button item_controls" @click.stop="character_unequip_item(row.slot)">{{ t('[卸下]') }}</div>
          </template>
          <div v-show="trading" class="trade_ammount_buttons">
            <div class="trade_ammount_button" @click="trade_amount(row, $event, 10)">10</div>
            <div class="trade_ammount_button" @click="trade_amount(row, $event, 100)">100</div>
            <div class="trade_ammount_button" @click="trade_amount(row, $event, 1000)">1k</div>
            <div class="trade_ammount_button" @click="trade_amount(row, $event, Infinity)">all</div>
          </div>
        </div>
      </template>
      <template #end>
        <span class="item_value item_controls" v-html="price_html(row)"></span>
      </template>
      <template #tooltip>
        <Tooltip :width="200">
          <template #content>
            <ItemTooltip :item="row.item" :options="{ trader: row.trade }" />
          </template>
        </Tooltip>
      </template>
    </ItemTableRow>
  </ItemTable>
  <Tabs
    id="inventory_sorting_div"
    size="sm"
    v-model="inventory_panel.sort_by"
    v-model:inverted="sortInverted"
    :items="[
      { id: 'price', label: t('价值排序') },
      { id: 'name', label: t('名称排序') },
    ]"
  />
  <Tabs
    id="inventory_control_div"
    size="lg"
    v-model="inventory_panel.filter"
    :items="[
      { id: 'all', label: t('全部') },
      { id: 'equipment', label: t('装备') },
      { id: 'consumable', label: t('消耗品') },
      { id: 'loot', label: t('掉落物') },
      { id: 'other', label: t('杂项') },
    ]"
  />
</template>
