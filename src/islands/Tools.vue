<script setup vapor>
import EquipmentSlot from '../components/EquipmentSlot.vue'

const slots = ['axe', 'pickaxe', 'sickle']
</script>

<template>
  <EquipmentSlot v-for="name in slots" :key="name" :name="name" />
</template>
