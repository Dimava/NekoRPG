<script setup vapor>
import { computed } from 'vue'
import Bar from '../components/Bar.vue'
import { character } from 'game/character'
import { active_effects } from 'game/main'
import { format_number, get_character_power, get_power_rank } from 'game/display'
import { t } from 'game/t'
import { REALMS } from 'game/realms'

const full = () => character.stats.full

function rename(event) {
  const value = event.target.value
  character.name = value.toString().trim().length > 0 ? value : 'Hero'
}

const xp_needed = computed(() => REALMS[character.xp.current_level + 1][4])
const xp_label = computed(() => `Next : ${format_number(character.xp.current_xp)}/${format_number(xp_needed.value)}`)

const health_label = computed(() => `${format_number(full().health)}/${format_number(full().max_health)} HP`)
// 死线 (deadline) tints the bar purple while it is active
const health_fill = computed(() => active_effects['死线'] !== undefined ? 'rgb(189,46,255)' : 'rgb(255,46,46)')

// Yangang territory rank: combat power mapped to a leaderboard position through a fitted curve
const rank = computed(() => {
  return get_power_rank(get_character_power()).toLocaleString('en-US')
})
const rank_label = computed(() => t`燕岗领排名: ${rank.value}`)
</script>

<template>
  <div class="py-2">
    <div class="text-center">
      <input
        id="character_name_field"
        type="text"
        class="inline-block w-30 border-2 border-solid border-[gray] text-center text-[16px] text-white"
        :style="{ backgroundImage: 'var(--background_gradient)' }"
        :value="character.name"
        @change="rename"
      >
    </div>

    <div class="mx-auto mt-2 w-[85%]">
      <Bar :value="character.xp.current_xp" :max="xp_needed" :height="20">{{ xp_label }}</Bar>
    </div>

    <div class="mx-auto mt-2 w-[85%]">
      <Bar :value="full().health" :max="full().max_health" :fill="health_fill" track="rgba(255, 46, 46, 0.3)" outline="rgb(199, 0, 0)">
        {{ health_label }}
      </Bar>
    </div>

    <div id="bi-rank" class="mt-2 w-full py-px text-center text-[18px] font-bold">
      {{ rank_label }}
    </div>
  </div>
</template>
