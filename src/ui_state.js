import { reactive } from '@vue/reactivity'

export const ui_state = reactive({
  inventoryTab: 'inventory',
  characterTab: 'stats',
  journalTab: 'bestiary',
  skillTab: 'skills',
  optionsOpen: false,
  helpOpen: false,
  // realm breakthrough animations playing right now, cleared by the ScreenEffects island when they end
  screen_effect: null, // 'active' | 'orbit-single' | 'orbit-double'
  sky_break: false,
  cloudy_break: false,
})
