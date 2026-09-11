<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { levelary_panel, format_number, format_numberL, format_money } from 'game/display'
import { locations, location_types } from 'game/locations'
import { character } from 'game/character'
import { inf_combat } from 'game/main'
import { item_templates } from 'game/items'
import { enemy_templates } from 'game/enemies'
import Tooltip from '../components/Tooltip.vue'

const TYPE_NAME = { dark: '黑暗', aura: '光环', stress: '威压', toxic: '毒液' }
const TYPE_STAGE = { 1: 'I', 2: 'II', 3: 'III' }

const entries = computed(() => {
  return Object.keys(levelary_panel.shown)
    .filter(name => locations[name] && locations[name].rank != 0)
    .sort((a, b) => locations[b].rank - locations[a].rank)
})

function rank_label(level) {
  return `${Math.floor(level.rank / 100) + 1} - ${Math.floor((level.rank % 100) / 10) + 1} - ${level.rank % 10}`
}

function halo(level_name) {
  const level = locations[level_name]
  if (!level || level.enemy_stat_halo == 0) return 0
  let c_halo = level.enemy_stat_halo
  if (level_name == '纳家秘境 - ∞') {
    c_halo = (inf_combat.A6?.cur ?? 0) * 0.08
  }
  if (level_name.includes('赫尔沼泽')) {
    inf_combat.B3 = inf_combat.B3 || 0
    c_halo = inf_combat.B3 * 0.01
  }
  if (level_name.includes('鲜血峰 - ')) {
    const key_id1 = item_templates['血峰限制器'].getInventoryKey()
    let key_cnt1 = character.inventory[key_id1] ? character.inventory[key_id1].count : 0
    key_cnt1 = Math.min(key_cnt1, 5)
    if (key_cnt1 != 0) c_halo *= 1 - 0.2 * key_cnt1
    const key_id2 = item_templates['血峰增幅器'].getInventoryKey()
    let key_cnt2 = character.inventory[key_id2] ? character.inventory[key_id2].count : 0
    key_cnt2 = Math.min(key_cnt2, 999025)
    if (key_cnt2 != 0) c_halo *= 1 + 0.2 * (key_cnt2 ** 0.5)
  }
  return c_halo
}

function avg_loot(level) {
  const n = level.enemies_list.length
  const I_list = {}
  let predict_value = 0
  for (const enemy_name of level.enemies_list) {
    const C_enemy = enemy_templates[enemy_name]
    for (const drop of C_enemy.loot_list) {
      I_list[drop.item_name] = (I_list[drop.item_name] || 0) + drop.chance
      predict_value += drop.chance * item_templates[drop.item_name].value * (drop.ignore_luck ? 1 : C_enemy.get_droprate_modifier())
    }
  }
  predict_value /= n
  const luck = character.stats.full.luck
  const lines = Object.keys(I_list).map(name => ({
    name,
    rate: format_numberL(I_list[name] * luck / n),
  }))
  return { lines, predict_value }
}
</script>

<template>
  <div
    v-for="name in entries"
    :key="name"
    class="bestiary_entry_div"
    :data-level-name="name"
    :data-levelary="-locations[name].rank"
  >
    <div class="bestiary_entry_name">{{ t(name) }}</div>
    <div class="bestiary_entry_kill_count">{{ rank_label(locations[name]) }}</div>
    <Tooltip :width="360">
      <template #content>
        <div v-html="t(locations[name].description)"></div>
        <div v-if="locations[name].types.length > 0">
          <br><br>{{ t('楼层属性：') }}
          <template v-for="(typ, j) in locations[name].types" :key="j">
            <br>{{ t(TYPE_NAME[typ.type]) }} {{ TYPE_STAGE[typ.stage] }} : {{ t(location_types[typ.type].stages[typ.stage].description) }}
          </template>
        </div>
        <div v-if="locations[name].enemy_stat_halo != 0">
          {{ t`光环 ${format_number(halo(name) * 100.0)} %(掉落 + ${format_number((Math.pow(halo(name)+1,1)-1)*100.0)}%,经验 + ${format_number((Math.pow(halo(name)+1,1.5)-1)*100.0)}%)` }}
        </div>
        <div>
          <br><br>{{ t('此处敌人：') }}<br>
          <img v-for="enemy_name in locations[name].enemies_list" :key="enemy_name" :src="enemy_templates[enemy_name].image">
        </div>
        <div>
          <br>{{ t('此处战利品(平均)：') }}<br>
          <template v-for="line in avg_loot(locations[name]).lines" :key="line.name">
            [ {{ t(line.name) }} ] - {{ line.rate }} <br>
          </template>
        </div>
        <div><br><span v-html="t`预期收益/敌人：${format_money(avg_loot(locations[name]).predict_value)}`"></span></div>
      </template>
    </Tooltip>
  </div>
</template>
