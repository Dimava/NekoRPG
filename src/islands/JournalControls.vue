<script setup vapor>
import { watch } from 'vue'
import { ui_state } from 'game/ui-state'
import { t } from 'game/t'
import Tabs from '../components/Tabs.vue'

watch(() => ui_state.journalTab, tab => {
  const set = (id, on) => {
    const el = document.getElementById(id)
    if (el) el.style.display = on ? 'block' : 'none'
  }
  set('quests_box_div', tab === 'quests')
  set('bestiary_box_div', tab === 'bestiary')
  set('levelary_box_div', tab === 'levelary')
}, { immediate: true })
</script>

<template>
  <Tabs
    edge="top"
    v-model="ui_state.journalTab"
    :items="[
      { id: 'quests', label: t('心之境界') },
      { id: 'bestiary', label: t('怪物手册') },
      { id: 'levelary', label: t('楼层手册') },
      { id: 'data', label: t('统计/银行') },
    ]"
  />
</template>
