<script setup vapor>
import { computed, ref } from 'vue'
import EquipmentSlot from '../components/EquipmentSlot.vue'
import { ui_state } from 'game/ui-state'
import { useHostVisibility } from '../components/useHostVisibility.js'

const slots = ['axe', 'pickaxe', 'sickle']
const root = ref(null)
const visible = computed(() => ui_state.characterTab === 'tools')
useHostVisibility(root, visible, 'grid')
</script>

<template>
  <span ref="root" hidden></span>
  <EquipmentSlot v-for="name in slots" :key="name" :name="name" v-show="visible" />
</template>
