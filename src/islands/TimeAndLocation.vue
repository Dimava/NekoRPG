<script setup vapor>
import { computed } from 'vue'
import Tooltip from '../components/Tooltip.vue'
import { current_game_time } from 'game/game-time'
import { format_number } from 'game/display'
import { location_types, get_location_type_penalty } from 'game/locations'
import { t } from 'game/t'
import { inf_combat, game_state } from 'game/main'
import { character } from 'game/character'
import { item_templates } from 'game/items'
import { skills } from 'game/skills'
import { stat_names } from 'game/misc'

const moons = '🌑🌒🌓🌔🌕🌖🌗🌘'
const typeNames = { dark: '黑暗', aura: '光环', stress: '威压', toxic: '毒液' }

const time = computed(() => {
  const daylight = current_game_time.hour >= 150 || current_game_time.hour < 30 ? '✨' : '☀️'
  const moon = current_game_time.moon()
  return `${current_game_time.toString()}${daylight}${moons[moon * 2]}${moons[moon * 2 + 1]}`
})

const location = computed(() => game_state.current_location)
const is_combat = computed(() => !!location.value && !('connected_locations' in location.value))

const name = computed(() => location.value ? t(location.value.name) : '')
const description = computed(() => {
  if (!is_combat.value) return ''
  return t(location.value.getDescription())
})

function haloValue(current) {
  let c_halo = current.enemy_stat_halo
  if (current.name == '纳家秘境 - ∞') {
    c_halo = (inf_combat.A6?.cur ?? 0) * 0.08
  }
  if (current.name.includes('赫尔沼泽')) {
    inf_combat.B3 = inf_combat.B3 || 0
    c_halo = inf_combat.B3 * 0.01
  }
  if (current.name.includes('鲜血峰 - ')) {
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

const displayedTypes = computed(() => {
  const current = location.value
  if (!current) return []

  const result = []
  const halo = haloValue(current)
  if (Number.isFinite(halo) && halo != 0) {
    result.push({ label: t`光环 ${format_number(halo * 100.0)} %`, description: '', multipliers: [], toxic: null })
  }

  for (const entry of current.types || []) {
    const { type, stage } = entry
    const { description, effects } = location_types[type].stages[stage]

    result.push({
      label: `${t(typeNames[type])}${stage > 1 ? ` ${'I'.repeat(stage)}` : ''}`,
      description: t(description),
      multipliers: Object.keys(effects?.multipliers || {}).map(stat => ({
        label: t(stat_names[stat]),
        base: effects.multipliers[stat],
        actual: Math.round(1000 * get_location_type_penalty(type, stage, stat)) / 1000,
      })),
      toxic: type == 'toxic'
        ? format_number(800e8 * (1 - skills['Toxic resistance'].current_level * 0.05) * (0.99 ** skills['Iron skin'].current_level))
        : null,
    })
  }
  return result
})
</script>

<template>
  <div id="tal-time" class="whitespace-nowrap border-b-1 border-b-solid border-white p-0.5 text-right">
    {{ time }}
  </div>

  <div class="flex items-start justify-between gap-2 p-1">
    <div id="tal-location-name" class="min-w-0">
      {{ name }}
      <Tooltip :disabled="!description" :width="360">
        <template #content>{{ description }}</template>
      </Tooltip>
    </div>

    <div id="tal-location-types" class="flex shrink-0 flex-wrap justify-end gap-x-2 text-right text-[12px]">
      <div v-for="(entry, index) in displayedTypes" :key="index">
        {{ entry.label }}
        <Tooltip :disabled="!entry.description" align="end">
          <template #content>
            <div>{{ entry.description }}</div>
            <div v-if="entry.multipliers.length" class="mt-2">
              <div v-for="stat in entry.multipliers" :key="stat.label">
                {{ stat.label }} x{{ stat.actual }}
                <template v-if="stat.base != stat.actual">[基础值: x{{ stat.base }}]</template>
              </div>
            </div>
            <div v-if="entry.toxic !== null">毒液伤害: {{ entry.toxic }}</div>
          </template>
        </Tooltip>
      </div>
    </div>
  </div>
</template>
