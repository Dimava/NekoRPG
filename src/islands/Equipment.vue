<script setup vapor>
import { computed, onMounted, ref } from 'vue'
import EquipmentSlot from '../components/EquipmentSlot.vue'
import { ui_state } from 'game/ui-state'
import { useHostVisibility } from '../components/useHostVisibility.js'

const slots = ['head', 'torso', 'legs', 'feet', 'weapon', 'method', 'realm', 'law', 'props', 'special']
const root = ref(null)
const visible = computed(() => ui_state.characterTab === 'equipment')
useHostVisibility(root, visible, 'grid')

onMounted(() => {
  const host = root.value?.parentElement
  if (!host) return
  host.style.gridTemplateColumns = '1fr 1fr'
  host.style.overflow = 'hidden'
  host.style.alignContent = 'start'
})
</script>

<template>
  <span ref="root" hidden></span>
  <EquipmentSlot v-for="name in slots" :key="name" :name="name" v-show="visible" />
</template>
