<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { stances } from 'game/stances'
import { skills } from 'game/skills'
import { stat_names } from 'game/misc'
import { faved_stances, fav_stance, change_stance, game_state } from 'game/main'
import Tooltip from '../components/Tooltip.vue'

const unlocked = computed(() => {
  return Object.keys(stances)
    .filter(id => stances[id].is_unlocked)
    .sort((a, b) => (stances[a].name > stances[b].name ? 1 : -1))
})

function stat_lines(id) {
  const stats = stances[id].getStats()
  return Object.keys(stats).map(stat => ({ key: stat, text: `x${Math.round(100 * stats[stat]) / 100} ${t(stat_names[stat])}` }))
}

function target_count(id) {
  const stance = stances[id]
  let n = stance.target_count
  if (n > 1 && stance.related_skill) {
    const skill = skills[stance.related_skill]
    n = n + Math.round(n * skill.current_level / skill.max_level)
  }
  return n
}

function hit_label(id) {
  const n = target_count(id)
  if (!(n > 1)) return ''
  return stances[id].randomize_target_count
    ? t`Randomly hits up to ${n} 个敌人`
    : t`同时攻击最多 ${n} 个敌人`
}
</script>

<template>
  <table id="stance_list">
    <tr class="stance_list_entry stance_list_header">
      <th class="stance_list_header stance_list_header_fav">{{ t('星标') }}</th>
      <th class="stance_list_header stance_list_header_select">{{ t('选择') }}</th>
      <th class="stance_list_header stance_list_header_name">{{ t('名称') }}</th>
    </tr>
    <tr v-for="id in unlocked" :key="id" class="stance_list_entry" :data-stance="id">
      <td class="stances_button stances_button_checkbox">
        <input
          type="checkbox"
          :id="'stances_fav_' + id"
          :checked="!!faved_stances[id]"
          @click.prevent="fav_stance(id)"
        >
      </td>
      <td class="stances_button stances_button_radio">
        <input
          type="radio"
          :id="'stances_select_' + id"
          name="stance_list_selection"
          :checked="id === game_state.selected_stance"
          @click.prevent="change_stance(id)"
        >
      </td>
      <td class="stances_name">
        <label :for="'stances_select_' + id">{{ t(stances[id].name) }}</label>
        <Tooltip :width="300">
          <template #content>
            <div>{{ t(stances[id].name) }}</div><br>
            <div>{{ t(stances[id].getDescription()) }}</div><br>
            <div class="stance_tooltip_stats"><template v-for="s in stat_lines(id)" :key="s.key"><br>{{ s.text }}</template></div>
            <div v-if="hit_label(id)" class="stance_tooltip_hitcount"><br>{{ hit_label(id) }}</div>
          </template>
        </Tooltip>
      </td>
    </tr>
  </table>
</template>
