<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { enemy_killcount, enemy_templates } from 'game/enemies'
import { format_number, format_numberL, format_money, spec_stat } from 'game/display'
import { item_templates } from 'game/items'
import { change_location } from 'game/main'
import Tooltip from '../components/Tooltip.vue'
import ItemTable from '../components/ItemTable.vue'

const ZONE_SENTINEL = {
  '毛茸茸': 11, '纳家待从': 12, '腐蚀质石精': 13, '夜行幽灵': 14, '行走树妖': 15,
  '妖灵飞蛾': 21, '百家近卫': 22, '大门派杂役': 23, '威武武士': 24, '废墟猎兵': 25,
  '废墟虫卒': 26, '荒兽电法兵': 27, '塔门战甲B1': 28, '无面修者': 31, '有角族壮年': 32,
  '冰原之痕': 33, '探险者的怨恨': 34, '大门派先锋': 35, '奇异菇菇': 36, '心魔': 37,
  '魔草绿球': 41, '水晶骷髅': 42, '燕岗战法小队': 43, '青茸茸将军': 44, '翩然蝶仙': 45,
}

const ZONE_NAME = {
  11: '纳家练兵场', 12: '燕岗城', 13: '燕岗城郊', 14: '地宫', 15: '地宫核心',
  21: '荒兽森林', 22: '清野江畔', 23: '纳家秘境', 24: '结界湖', 25: '声律城废墟',
  26: '声律城战场', 27: '天外飞船', 28: '飞船核心', 31: '赫尔沼泽', 32: '黑暗森林',
  33: '纯白冰原', 34: '极寒冰宫', 35: '时封水牢', 36: '传承幻境', 37: '幻境核心',
  41: '城门战', 42: '密林战', 43: '古墓战', 44: '毬毬山谷', 45: '鲜血峰',
  46: '破败之域', 47: '破败危壁', 48: '灭门战【WIP/需要剧情修正】', 51: '枯叶走廊',
  52: '灰魇【WIP】', 53: '灰魇庭院', 54: '珍珠海', 55: '风雷大会', 56: '行道盟审判战',
  61: '深林【WIP】', 62: '血魔海', 63: '炎眸【WIP】', 64: '葬地【WIP】', 65: '冗音圣树',
  66: '冗音之塔', 67: '音界', 68: '圣城【WIP】',
}

const ZONE_TP = {
  11: '纳家大厅', 12: '燕岗城', 13: '燕岗近郊', 14: '地宫浅层', 15: '地宫深层',
  21: '荒兽森林', 22: '清野江畔', 23: '纳家秘境 - 战斗区', 24: '结界湖', 25: '声律城废墟',
  26: '声律城战场', 27: '天外飞船', 28: '飞船核心', 31: '赫尔沼泽', 32: '黑暗森林',
  33: '纯白冰原', 34: '极寒冰宫', 35: '时封水牢', 36: '传承幻境', 37: '幻境核心·地宫',
  41: '狩猎大赛·城门战', 42: '狩猎大赛·密林战', 43: '狩猎大赛·古墓战', 44: '毬毬山谷',
  45: '鲜血峰', 46: '破败之域', 47: '破败危壁', 48: '灭门战【WIP/需要剧情修正】',
  51: '枯叶走廊', 52: '灰魇【WIP】', 53: '灰魇庭院', 54: '珍珠海', 55: '风雷大会',
  56: '行道盟审判战', 61: '深林【WIP】', 62: '血魔海', 63: '炎眸【WIP】', 64: '葬地【WIP】',
  65: '冗音圣树', 66: '冗音之塔', 67: '音界', 68: '圣城【WIP】',
}

const rows = computed(() => {
  const zones = new Set([11])
  const out = []
  for (const name of Object.keys(enemy_killcount)) {
    if (enemy_killcount[name] == null) continue
    const zone = ZONE_SENTINEL[name]
    if (zone) zones.add(zone)
    const enemy = enemy_templates[name]
    if (!enemy) continue
    out.push({ type: 'enemy', name, sort: -enemy.rank })
  }
  for (const zone of zones) {
    out.push({ type: 'zone', zone, sort: -100 * (zone + 1) })
  }
  out.sort((a, b) => a.sort - b.sort)
  return out
})

function spec_label(entry, enemy) {
  return typeof entry[1] === 'function' ? entry[1](enemy) : t(entry[1])
}

function spec_desc(entry, enemy) {
  return typeof entry[3] === 'function' ? entry[3](enemy) : t(entry[3])
}

function spec_html(enemy) {
  let html = ''
  for (const id of enemy.spec) {
    const entry = spec_stat[id]
    if (!entry) {
      console.error('特殊属性 编号[' + id + '] 未定义！')
      continue
    }
    html += `<br><b><font color="${entry[2]}">${spec_label(entry, enemy)} </font></b> ：${spec_desc(entry, enemy)} `
  }
  return html
}

function loot_current(drop, enemy) {
  if (drop.ignore_luck) return t('[Fixed]')
  const chance = drop.chance * enemy.get_droprate_modifier()
  return format_numberL(Number(chance.toPrecision(12)))
}

function loot_rows(enemy) {
  return enemy.loot_list.flatMap((drop, i) => {
    const item = item_templates[drop.item_name]
    if (!item) return []
    return [{
      key: drop.item_name + ':' + i,
      item,
      current: loot_current(drop, enemy),
    }]
  })
}

function predicted_value(enemy) {
  let value = 0
  for (const drop of enemy.loot_list) {
    const item = item_templates[drop.item_name]
    value += drop.chance * (drop.ignore_luck ? 1 : enemy.get_droprate_modifier()) * (item?.value ?? 0)
  }
  return value
}

function go_zone(zone) {
  change_location(ZONE_TP[zone])
}
</script>

<template>
  <div id="bestiary_list">
    <div
      v-for="row in rows"
      :key="row.type === 'zone' ? 'z' + row.zone : row.name"
      class="bestiary_entry_div"
      :data-bestiary="row.sort"
      :data-enemy-name="row.type === 'enemy' ? row.name : undefined"
    >
      <template v-if="row.type === 'zone'">
        <div class="bestiary_entry_name">
          <b><div @click="go_zone(row.zone)">【{{ t(ZONE_NAME[row.zone]) }}】</div></b>
        </div>
        <div class="bestiary_entry_kill_count">
          <b>{{ t('区域') }} {{ Math.floor(row.zone / 10) }} - {{ row.zone % 10 }}</b>
        </div>
      </template>
      <template v-else>
        <div class="bestiary_entry_name">{{ t(row.name) }}</div>
        <div class="bestiary_entry_kill_count">{{ enemy_killcount[row.name] }}</div>
        <Tooltip :width="360">
          <template #content>
            <div><img :src="enemy_templates[row.name].image"><br></div>
            <div v-html="t(enemy_templates[row.name].realm)"></div>
            <div v-html="t(enemy_templates[row.name].description)"></div>
            <div>
              <br>{{ t('属性:') }} <br>
              <div class="grid_container">
                <div class="stat_slot_div"><div class="stat_name">{{ t('HP:') }}</div><div class="stat_value">{{ format_number(enemy_templates[row.name].stats.health) }}</div></div>
                <div class="stat_slot_div"><div class="stat_name">{{ t('ATK:') }}</div><div class="stat_value">{{ format_number(enemy_templates[row.name].stats.attack) }}</div></div>
              </div>
              <div class="grid_container">
                <div class="stat_slot_div"><div class="stat_name">{{ t('DEF:') }}</div><div class="stat_value">{{ format_number(enemy_templates[row.name].stats.defense) }}</div></div>
                <div class="stat_slot_div"><div class="stat_name">{{ t('SPD:') }}</div><div class="stat_value">{{ format_number(enemy_templates[row.name].stats.attack_speed) }}</div></div>
              </div>
              <div class="grid_container">
                <div class="stat_slot_div"><div class="stat_name">{{ t('AGI:') }}</div><div class="stat_value">{{ format_number(Math.round(enemy_templates[row.name].stats.agility)) }}</div></div>
                <div class="stat_slot_div"><div class="stat_name">{{ t('XP:') }}</div><div class="stat_value">{{ format_number(Math.round(enemy_templates[row.name].xp_value)) }}</div></div>
              </div>
              <div v-html="spec_html(enemy_templates[row.name])"></div>
            </div>
            <div v-if="enemy_templates[row.name].loot_list.length > 0">
              <br>{{ t('战利品:') }}
              <ItemTable :rows="loot_rows(enemy_templates[row.name])" bar="64px">
                <template #right="{ row }">{{ row.current }}</template>
              </ItemTable>
            </div>
            <div><br><span v-html="t`预期收益: ${format_money(predicted_value(enemy_templates[row.name]))}`"></span></div>
          </template>
        </Tooltip>
      </template>
    </div>
  </div>
</template>
