<script setup vapor>
import { computed } from 'vue'
import { current_game_time } from 'game/game-time'

const moons = '🌑🌒🌓🌔🌕🌖🌗🌘'

const label = computed(() => {
  const daylight = current_game_time.hour >= 150 || current_game_time.hour < 30 ? '✨' : '☀️'
  const moon = current_game_time.moon()
  return `${current_game_time.toString()}${daylight}${moons[moon * 2]}${moons[moon * 2 + 1]}`
})
</script>

<template>
  <span>{{ label }}</span>
</template>
