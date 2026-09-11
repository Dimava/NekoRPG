import { reactive } from '@vue/reactivity'

export const ui_state = reactive({
  inventoryTab: 'inventory',
  characterTab: 'stats',
  journalTab: 'bestiary',
  skillTab: 'skills',
  optionsOpen: false,
})
