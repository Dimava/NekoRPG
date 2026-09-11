<script setup vapor>
import { computed, ref } from 'vue'
import { ui_state } from 'game/ui-state'
import { useHostVisibility } from '../components/useHostVisibility.js'
import Tooltip from '../components/Tooltip.vue'
import { character } from 'game/character'
import { active_effects } from 'game/main'
import { describe_effect, format_number, format_numberL } from 'game/display'
import { format_time } from 'game/game-time'
import { t } from 'game/t'
import { REALMS } from 'game/realms'

const full = () => character.stats.full
const root = ref(null)
const visible = computed(() => ui_state.characterTab === 'stats')
useHostVisibility(root, visible, '')

const rows = [
  { key: 'attack_power', label: 'ATK:', description: '攻击，受等级/装备/技能影响', value: () => format_number(character.get_attack_power()) },
  { key: 'defense', label: 'DEF:', description: '防御，用于抵消攻击伤害' },
  { key: 'agility', label: 'AGI:', description: '敏捷，影响命中率/闪避率' },
  { key: 'attack_speed', label: 'SPD:', description: '攻击速度，影响每次攻击花费时间', value: () => format_number(character.get_attack_speed()) },
  { key: 'crit_rate', label: 'C.rate:', description: '打出暴击的概率', value: () => format_numberL(full().crit_rate) },
  { key: 'crit_multiplier', label: 'C.mult:', description: '打出暴击的伤害倍率', value: () => format_numberL(full().crit_multiplier) },
  { key: 'max_health', label: 'MaxHP:', description: '生命上限' },
  {
    key: 'health_regeneration_flat', label: 'HP/s:', description: '生命恢复',
    value: () => format_number(full().health_regeneration_flat + full().max_health * full().health_regeneration_percent * 0.01),
  },
  { key: 'attack_mul', label: 'A.mul:', description: '普通攻击的伤害倍率', unlock: 8, value: () => format_numberL(full().attack_mul) },
  { key: 'luck', label: 'Luck:', description: '幸运(影响材料掉率,杀怪经验)', unlock: 18, value: () => format_numberL(full().luck) },
  { key: 'SCGV', label: 'SCGV:', description: '宝石耐性，全称宝石软上限起始点倍率(SoftCappedGemValue)', unlock: 28 },
  { key: null, label: '', description: '' },
]

const source_names = {
  level: '境界', skills: '技能', skill_milestones: '技能里程碑', equipment: '装备',
  environment: '环境', light_level: '光照', gems: '宝石', stance: '秘法',
  active_effect: '效果', coins: '心之境界',
}

function breakdown(key) {
  const lines = [t`${t('基础值:')} ${Math.round(100 * character.base_stats[key]) / 100}`]

  if (key === 'attack_power' && character.equipment.weapon) {
    lines.push(`${t('武器:')} +${format_number(character.equipment.weapon.attack_power)}`)
  }
  for (const [source, stats] of Object.entries(character.stats.flat)) {
    if (stats[key]) lines.push(t`${source_names[source]}: ${stats[key] > 0 ? '+' : ''}${format_number(stats[key])}`)
  }
  for (const [source, stats] of Object.entries(character.stats.multiplier)) {
    if (stats[key] && stats[key] !== 1) lines.push(t`${source_names[source]}: x${format_number(stats[key])}`)
  }
  return lines
}

const realm = computed(() => REALMS[character.xp.current_level])
const realm_label = computed(() => t`境界 : ${realm.value[1]}`)

const stats = computed(() => rows.map(row => {
  const locked = !row.key || (row.unlock && character.xp.current_level <= row.unlock)
  if (locked) return { label: 'Locked', value: '', description: 'Not available', breakdown: [] }

  return {
    label: row.label,
    value: row.value ? row.value() : format_number(full()[row.key]),
    description: row.description,
    breakdown: breakdown(row.key),
  }
}))

const effects = computed(() => Object.values(active_effects).map(effect => ({
  ...describe_effect(effect.name),
  duration: format_time({ time: { minutes: effect.duration } }),
})))
</script>

<template>
  <div ref="root" v-show="visible" class="h-full flex flex-col">
    <div id="cs-realm" class="border border-solid border-white py-px text-center font-bold">
      <span :class="`realm_${realm[5]}`">{{ realm_label }}</span>
    </div>

    <div id="cs-stats" class="grid grid-cols-2">
      <div
        v-for="(stat, index) in stats" :key="index"
        class="box-border h-5 flex items-center justify-between gap-1 px-1 leading-5 outline outline-1 outline-white outline-solid"
      >
        <span class="shrink-0">{{ t(stat.label) }}</span>
        <span class="truncate">{{ stat.value }}</span>
        <Tooltip :width="300">
          <template #content>
            <div>{{ t(stat.description) }}</div>
            <div v-if="stat.breakdown.length" class="mt-1">
              <div>{{ t('分析:') }}</div>
              <div v-for="line in stat.breakdown" :key="line">{{ line }}</div>
            </div>
          </template>
        </Tooltip>
      </div>
    </div>

    <div id="cs-effects" class="mt-auto flex justify-center gap-2 bg-[var(--background_gradient)] px-1 py-0.5 text-[16px]">
      <span>{{ t('生效效果:') }}</span>
      <span class="font-bold">{{ effects.length }}</span>
      <Tooltip :width="300">
        <template #content>
          <div v-if="!effects.length">{{ t('无效果') }}</div>
          <div v-for="effect in effects" :key="effect.name">
            <div class="flex justify-between gap-2 border-b border-b-solid border-b-gray">
              <span>{{ t`'${t(effect.name)}' : ` }}</span>
              <span>{{ effect.duration }}</span>
            </div>
            <div v-for="stat in effect.stats" :key="stat.name">{{ t(stat.name) }} : {{ stat.value }}</div>
          </div>
        </template>
      </Tooltip>
    </div>
  </div>
</template>
