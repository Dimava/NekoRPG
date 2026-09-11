<script setup vapor>
import { ui_state } from 'game/ui-state'
import { t } from 'game/t'

function select(tab) {
  ui_state.characterTab = tab
}
</script>

<template>
  <div id="character_show_stats" class="character_control_button" :class="{ active_selection_button: ui_state.characterTab === 'stats' }" @click="select('stats')">{{ t('属性') }}</div>
  <div id="character_show_equipment" class="character_control_button" :class="{ active_selection_button: ui_state.characterTab === 'equipment' }" @click="select('equipment')">{{ t('装备') }}</div>
  <div id="character_show_tools" class="character_control_button" :class="{ active_selection_button: ui_state.characterTab === 'tools' }" @click="select('tools')">{{ t('工具') }}</div>
</template>
