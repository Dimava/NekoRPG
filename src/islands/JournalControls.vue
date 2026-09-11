<script setup vapor>
import { watch } from 'vue'
import { ui_state } from 'game/ui-state'
import { t } from 'game/t'

function select(tab) {
  ui_state.journalTab = tab
}

watch(() => ui_state.journalTab, tab => {
  const set = (id, on) => {
    const el = document.getElementById(id)
    if (el) el.style.display = on ? 'block' : 'none'
  }
  set('quests_box_div', tab === 'quests')
  set('bestiary_box_div', tab === 'bestiary')
  set('levelary_box_div', tab === 'levelary')
  set('levelary_list', tab === 'levelary')
}, { immediate: true })
</script>

<template>
  <div id="journal_show_quests" class="journal_control_button" :class="{ active_selection_button: ui_state.journalTab === 'quests' }" @click="select('quests')">{{ t('心之境界') }}</div>
  <div id="journal_show_bestiary" class="journal_control_button" :class="{ active_selection_button: ui_state.journalTab === 'bestiary' }" @click="select('bestiary')">{{ t('怪物手册') }}</div>
  <div id="journal_show_levelary" class="journal_control_button" :class="{ active_selection_button: ui_state.journalTab === 'levelary' }" @click="select('levelary')">{{ t('楼层手册') }}</div>
  <div id="journal_show_data" class="journal_control_button" :class="{ active_selection_button: ui_state.journalTab === 'data' }" @click="select('data')">{{ t('统计/银行') }}</div>
</template>
