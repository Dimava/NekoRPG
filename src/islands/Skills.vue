<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { skills, get_unlocked_skill_rewards, get_next_skill_milestone } from 'game/skills'
import { get_skill_xp_gain } from 'game/character'
import { format_number, skill_panel } from 'game/display'
import Tooltip from '../components/Tooltip.vue'
import Tabs from '../components/Tabs.vue'

const CATEGORY = {
  Activity: '行动',
  Character: '角色',
  Combat: '战斗',
  Environmental: '环境',
  Weapon: '武器',
  Stance: '秘法',
  Crafting: '合成',
  Gathering: '收集',
}

const categories = computed(() => {
  const cats = new Set()
  for (const id of Object.keys(skill_panel.shown)) {
    if (skills[id]) cats.add(skills[id].category)
  }
  return [...cats].sort()
})

function ids_in(cat) {
  const ids = Object.keys(skill_panel.shown).filter(id => skills[id]?.category === cat)
  const dir = skill_panel.direction === 'asc' ? 1 : -1
  ids.sort((a, b) => {
    const ea = skill_panel.sort_by === 'level' ? skills[a].current_level : skills[a].name()
    const eb = skill_panel.sort_by === 'level' ? skills[b].current_level : skills[b].name()
    return ea > eb ? dir : -dir
  })
  return ids
}

function toggle(cat, event) {
  if (event.target.closest('[data-skill_category_skills]')) return
  skill_panel.expanded[cat] = !skill_panel.expanded[cat]
}

function is_max(skill) {
  return skill.current_xp === 'Max'
}

function xp_pct(skill) {
  if (is_max(skill) || !(skill.xp_to_next_lvl > 0)) return 100
  return 100 * skill.current_xp / skill.xp_to_next_lvl
}

function xp_label(skill) {
  if (is_max(skill)) return t`Max!`
  return t`${100 * Math.round(skill.current_xp / skill.xp_to_next_lvl * 1000) / 1000}%`
}

function xp_text(skill) {
  if (is_max(skill)) return t('已满级')
  return t`${format_number(skill.current_xp)}/${format_number(skill.xp_to_next_lvl)}`
}

function xp_gain(skill) {
  return Math.round(100 * skill.get_parent_xp_multiplier() * get_skill_xp_gain(skill.skill_id)) / 100 || 1
}

function next_milestone(skill) {
  return get_next_skill_milestone(skill.skill_id)
}

function rewards(skill) {
  return get_unlocked_skill_rewards(skill.skill_id)
}

function desc_html(skill) {
  return t`<span class="skill_id">id: "${skill.skill_id}"</span><br><br>${t(skill.description)}`
}
const sortInverted = computed({
  get: () => skill_panel.direction === 'desc',
  set: v => { skill_panel.direction = v ? 'desc' : 'asc' },
})
</script>

<template>
  <div id="skill_list">
    <div
      v-for="cat in categories"
      :key="cat"
      class="skill_category_div"
      :class="{ skill_category_expanded: skill_panel.expanded[cat] }"
      :data-skill_category="cat"
      @click="toggle(cat, $event)"
    >
      <i class="material-icons icon skill_dropdown_icon"> keyboard_double_arrow_down </i>{{ t(CATEGORY[cat] || cat) }} {{ t('技能') }}
      <div data-skill_category_skills>
        <div v-for="id in ids_in(cat)" :key="id" class="skill_div" :data-skill="id">
          <div class="skill_bar_max">
            <div class="skill_bar_text">
              <div class="skill_bar_name">{{ t`${t(skills[id].name())} : level ${skills[id].current_level}/${skills[id].max_level}` }}</div>
              <div class="skill_bar_xp">{{ xp_label(skills[id]) }}</div>
            </div>
            <div class="skill_bar_current" :style="{ width: xp_pct(skills[id]) + '%' }"></div>
            <Tooltip :width="300">
              <template #content>
                <div>{{ xp_text(skills[id]) }}</div>
                <div class="skill_xp_gain" v-html="t`经验获取: x${xp_gain(skills[id])}<br><span>经验消耗蠕变: x${skills[id].xp_scaling}</span>`"></div>
                <div v-html="desc_html(skills[id])"></div>
                <div v-if="skills[id].get_effect_description()"><br></div>
                <div v-html="t`${skills[id].get_effect_description()}`"></div>
                <div v-if="rewards(skills[id])" v-html="t`<br>${rewards(skills[id])}`"></div>
                <div v-if="next_milestone(skills[id])" class="skill_tooltip_next_milestone">{{ t`lvl ${next_milestone(skills[id])}: ???` }}</div>
              </template>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  </div>
  <Tabs
    id="skill_sorting_buttons"
    v-model="skill_panel.sort_by"
    v-model:inverted="sortInverted"
    :items="[
      { id: 'name', label: t('名称排序') },
      { id: 'level', label: t('等级排序') },
    ]"
  />
</template>
