<script setup vapor>
import { computed, watchEffect } from 'vue'
import { ui_state } from 'game/ui-state'
import { character } from 'game/character'

// realm color theme; body carries it so every panel's CSS variables follow
const theme = computed(() => {
  const level = character.xp.current_level
  if (level >= 29) return ui_state.cloudy_break ? 'cloudy_root_proto' : 'cloudy_root'
  if (level >= 19) return 'sky_root'
  if (level >= 9) return 'terra_root'
  return null
})

const THEMES = ['terra_root', 'sky_root', 'cloudy_root_proto', 'cloudy_root']

watchEffect(() => {
  for (const cls of THEMES) document.body.classList.toggle(cls, cls === theme.value)
  // the cloudy breakthrough also shrinks and regrows the whole game screen
  document.documentElement.toggleAttribute('data-cloudy-break', ui_state.cloudy_break)
})
</script>

<template>
  <div id="screen_effect" :class="ui_state.screen_effect" @animationend="ui_state.screen_effect = null"></div>
  <div id="sky_effect" :class="{ 'sky-break': ui_state.sky_break }" @animationend="ui_state.sky_break = false"></div>
  <div id="cloudy_effect" :class="{ 'cloudy-break': ui_state.cloudy_break }" @animationend="ui_state.cloudy_break = false"></div>
</template>
