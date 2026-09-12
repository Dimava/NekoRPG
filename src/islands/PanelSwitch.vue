<script setup vapor>
import { computed, watch } from 'vue'
import { ui_state } from 'game/ui-state'
import { location_panel } from 'game/display'
import { t } from 'game/t'
import Tabs from '../components/Tabs.vue'

const combatEnabled = computed(() => location_panel.combat)

watch(() => ui_state.inventoryTab, tab => {
  document.documentElement.style.setProperty('--inventory_div_display', tab === 'inventory' ? 'grid' : 'none')
  document.documentElement.style.setProperty('--character_combat_div_display', tab === 'combat' ? 'block' : 'none')
}, { immediate: true })
</script>

<template>
  <Tabs
    size="lg"
    bold
    edge="top"
    v-model="ui_state.inventoryTab"
    :items="[
      { id: 'inventory', label: t('物品栏') },
      { id: 'combat', label: t('战斗'), disabled: !combatEnabled },
    ]"
  />
</template>
