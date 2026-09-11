<script setup vapor>
import { computed, watch } from 'vue'
import { ui_state } from 'game/ui-state'
import { location_panel } from 'game/display'
import { t } from 'game/t'

const combatEnabled = computed(() => location_panel.combat)

function select(tab) {
  if (tab === 'combat' && !combatEnabled.value) return
  ui_state.inventoryTab = tab
}

watch(() => ui_state.inventoryTab, tab => {
  document.documentElement.style.setProperty('--inventory_div_display', tab === 'inventory' ? 'grid' : 'none')
  document.documentElement.style.setProperty('--character_combat_div_display', tab === 'combat' ? 'block' : 'none')
}, { immediate: true })
</script>

<template>
  <div
    id="switch_to_inventory"
    :class="{ active_selection_button: ui_state.inventoryTab === 'inventory' }"
    @click="select('inventory')"
  >{{ t('物品栏') }}</div>
  <div
    id="switch_to_combat"
    :class="{ active_selection_button: ui_state.inventoryTab === 'combat' }"
    :style="combatEnabled
      ? { pointerEvents: 'auto', cursor: 'pointer', color: 'white' }
      : { pointerEvents: 'none', cursor: 'default', color: 'gray' }"
    @click="select('combat')"
  >{{ t('战斗') }}</div>
</template>
