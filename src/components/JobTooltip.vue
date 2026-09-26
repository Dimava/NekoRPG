<script setup vapor>
import { format_time } from 'game/game-time'
import Money from './Money.vue'

// Opening hours and pay of a job.
defineProps({ activity: { type: Object, required: true } })
</script>

<template>
  <template v-if="!activity.infinite">Available from {{ activity.availability_time.start }} to {{ activity.availability_time.end }} <br></template>
  Pays <Money :value="activity.get_payment()" /> per every {{ format_time({ time: { minutes: activity.working_period } }) }} worked
</template>
