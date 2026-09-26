<script setup vapor>
import { computed } from 'vue'
import { money_coins } from 'game/display'

// Coins for an amount of money, the two highest tiers that are not zero.
const props = defineProps({ value: { type: Number, default: 0 } })
const money = computed(() => money_coins(props.value))
</script>

<template>
  <template v-if="!money.coins.length">0</template>
  <template v-else>{{ money.sign }}<template v-for="c in money.coins" :key="c.cls"><span class="coin" :class="c.cls">{{ c.text }}</span>{{ ' ' }}</template></template>
</template>
