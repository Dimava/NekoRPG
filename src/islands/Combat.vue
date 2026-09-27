<script setup vapor>
import { computed, watchEffect } from 'vue'
import { t } from 'game/t'
import { game_state } from 'game/main'
import { character } from 'game/character'
import { format_number } from 'game/display'
import { get_hit_chance } from 'game/misc'

// combat zones have a parent instead of connected locations; style.css shows this panel
// and shrinks the actions box while the root carries the attribute
watchEffect(() => {
  const location = game_state.current_location
  document.documentElement.toggleAttribute('data-combat-location', !!location && !('connected_locations' in location))
})

const enemies = computed(() => game_state.current_enemies || [])
const alive_count = computed(() => enemies.value.filter(e => e.is_alive).length)

const waves_left = computed(() => {
  const loc = game_state.current_location
  if (!loc?.enemy_count) return 0
  return loc.enemy_count - loc.enemy_groups_killed % loc.enemy_count
})

function speed(enemy) {
  const s = enemy.stats.attack_speed
  if (s > 20) return Math.round(s)
  if (s > 2) return Math.round(s * 10) / 10
  return Math.round(s * 100) / 100
}

function agi_mod(enemy) {
  if (enemy.spec?.includes(65)) return 1 + enemy.stats.health / enemy.stats.max_health * 99
  return 1
}

function hit_label(enemy) {
  const hero_eva = alive_count.value ** (-1 / 3)
  let hit = get_hit_chance(enemy.stats.agility * agi_mod(enemy), character.stats.full.agility * hero_eva)
  if (character.equipment['off-hand']?.offhand_type === 'shield') hit = 1
  const n = Math.floor(100 * hit)
  return n != 100 ? n + '%' : 'MAX'
}

function eva_label(enemy) {
  const hero_hit = alive_count.value ** (1 / 3)
  const eva = 1 - get_hit_chance(character.stats.full.agility * hero_hit, enemy.stats.agility * agi_mod(enemy))
  const n = Math.floor(100 * eva)
  return n != 100 ? n + '%' : 'MAX'
}

function hp_text(enemy) {
  if (!enemy.is_alive) return '0 hp'
  return `${format_number(enemy.stats.health)}/${format_number(enemy.stats.max_health)} hp`
}

function hp_pct(enemy) {
  if (!enemy.is_alive) return 0
  return Math.min(100, Math.max(0, 100 * enemy.stats.health / enemy.stats.max_health))
}

function attack_pct(i) {
  return Math.min((game_state.enemy_attack_progress[i] || 0) * 100, 100)
}

function clear_flash(enemy) {
  enemy.flash = ''
}
</script>

<template>
  <div id="enemies_div">
    <div v-for="(enemy, i) in enemies" :key="i" class="enemy_div">
      <div v-if="enemy.stats" :style="{ filter: enemy.is_alive ? 'brightness(100%)' : 'brightness(30%)' }">
        <div class="enemy_name">
          <img :src="enemy.image"><br>
        </div>
        <div class="enemy_stats">
          <div class="enemy_stat enemy_stat_long">{{ t`伤害:${format_number(enemy.stats.attack)}` }}</div>
          |
          <div class="enemy_stat enemy_stat_long">{{ t`防御:${format_number(enemy.stats.defense)}` }}</div>
          |
          <div class="enemy_stat enemy_stat_short">{{ t`攻速:${format_number(speed(enemy))}` }}</div>
          |
          <div class="enemy_stat enemy_stat_short">{{ t`命中:${hit_label(enemy)}` }}</div>
          |
          <div class="enemy_stat enemy_stat_short">{{ t`闪避:${eva_label(enemy)}` }}</div>
        </div>
        <div class="enemy_health_div">
          <div class="enemy_healthbar_max">
            <div class="enemy_healthbar_current" :style="{ width: hp_pct(enemy) + '%' }"></div>
          </div>
          <div class="enemy_health_value">{{ hp_text(enemy) }}</div>
        </div>
        <div class="enemy_attack_bar" :style="{ width: attack_pct(i) + '%' }"></div>
        <div class="enemy_effect" :class="enemy.flash" @animationend="clear_flash(enemy)"></div>
      </div>
    </div>
  </div>
  <div id="enemy_count_div">
    <div id="enemy_count_content">
      <div style="display:inline-block;">{{ t('剩余波数:') }}</div>
      <div id="enemies_left_div">{{ waves_left }}</div>
    </div>
  </div>
</template>
