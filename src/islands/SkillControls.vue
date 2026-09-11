<script setup vapor>
import { watch } from 'vue'
import { ui_state } from 'game/ui-state'
import { t } from 'game/t'

const panels = {
  skills: { id: 'skill_list_div', display: 'grid' },
  stances: { id: 'stance_list_div', display: 'block' },
  family: { id: 'family_div', display: 'block' },
}

function select(tab) {
  ui_state.skillTab = tab
}

watch(() => ui_state.skillTab, tab => {
  for (const [key, { id, display }] of Object.entries(panels)) {
    const el = document.getElementById(id)
    if (el) el.style.display = key === tab ? display : 'none'
  }
}, { immediate: true })
</script>

<template>
  <div id="show_skills" class="skill_stance_control_button" :class="{ active_selection_button: ui_state.skillTab === 'skills' }" @click="select('skills')">{{ t('技能') }}</div>
  <div id="show_stances" class="skill_stance_control_button" :class="{ active_selection_button: ui_state.skillTab === 'stances' }" @click="select('stances')">{{ t('姿态') }}</div>
  <div id="show_family" class="skill_stance_control_button" :class="{ active_selection_button: ui_state.skillTab === 'family' }" @click="select('family')">{{ t('家族') }}</div>
</template>
