<script setup vapor>
import { watch } from 'vue'
import { ui_state } from 'game/ui-state'
import { t } from 'game/t'
import Tabs from '../components/Tabs.vue'

const panels = {
  skills: { id: 'skill_list_div', display: 'grid' },
  stances: { id: 'stance_list_div', display: 'block' },
  family: { id: 'family_div', display: 'block' },
}

watch(() => ui_state.skillTab, tab => {
  for (const [key, { id, display }] of Object.entries(panels)) {
    const el = document.getElementById(id)
    if (el) el.style.display = key === tab ? display : 'none'
  }
}, { immediate: true })
</script>

<template>
  <Tabs
    v-model="ui_state.skillTab"
    :items="[
      { id: 'skills', label: t('技能') },
      { id: 'stances', label: t('姿态') },
      { id: 'family', label: t('家族') },
    ]"
  />
</template>
