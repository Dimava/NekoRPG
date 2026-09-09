<script setup vapor>
import EquipmentSlot from '../components/EquipmentSlot.vue'

const slots = ['head', 'torso', 'legs', 'feet', 'weapon', 'method', 'realm', 'law', 'props', 'special']
</script>

<template>
  <EquipmentSlot v-for="name in slots" :key="name" :name="name" />
</template>
