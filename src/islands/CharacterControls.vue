<script setup vapor>
import { ui_state } from 'game/ui-state'
import { t } from 'game/t'
import Tabs from '../components/Tabs.vue'
</script>

<template>
  <Tabs
    v-model="ui_state.characterTab"
    :items="[
      { id: 'stats', label: t('属性') },
      { id: 'equipment', label: t('装备') },
      { id: 'tools', label: t('工具') },
    ]"
  />
</template>
