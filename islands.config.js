// Only new UI components are compiled. Existing NekoRPG modules remain
// browser-native ES modules outside the island build.
export const internals = ['./src/components', './src/islands']
export const outDir = 'ui'

// These aliases resolve to the game's existing files at their existing URLs.
// They are never copied, transformed, or bundled.
export const imports = {
  'game/game-time': { source: 'src/game_time.js', url: './src/game_time.js' },
  'game/display': { source: 'src/display.js', url: './src/display.js' },
  'game/locations': { source: 'src/locations.js', url: './src/locations.js' },
  'game/realms': { source: 'src/realms.js', url: './src/realms.js' },
  'game/ui-state': { source: 'src/ui_state.js', url: './src/ui_state.js' },
  'game/t': { source: 'src/i18n.js', url: './src/i18n.js' },
  'game/main': { source: 'src/main.js', url: './src/main.js' },
  'game/character': { source: 'src/character.js', url: './src/character.js' },
  'game/items': { source: 'src/items.js', url: './src/items.js' },
  'game/skills': { source: 'src/skills.js', url: './src/skills.js' },
  'game/misc': { source: 'src/misc.js', url: './src/misc.js' },
  'game/enemies': { source: 'src/enemies.js', url: './src/enemies.js' },
  'game/gems': { source: 'src/gems.js', url: './src/gems.js' },
  'game/stances': { source: 'src/combat_stances.js', url: './src/combat_stances.js' },
  'game/traders': { source: 'src/traders.js', url: './src/traders.js' },
  'game/trade': { source: 'src/trade.js', url: './src/trade.js' },
  'game/dialogues': { source: 'src/dialogues.js', url: './src/dialogues.js' },
  'game/activities': { source: 'src/activities.js', url: './src/activities.js' },
  'game/crafting-recipes': { source: 'src/crafting_recipes.js', url: './src/crafting_recipes.js' },
}

export const hostImportMap = {
  vue: './ui/vue.js',
  '@vue/reactivity': './ui/reactivity.js',
  ...Object.fromEntries(Object.entries(imports).map(([name, entry]) => [name, entry.url])),
}

export const runtimeExports = [
  'reactive', 'shallowReactive', 'readonly', 'shallowReadonly',
  'ref', 'shallowRef', 'computed', 'watch', 'watchEffect',
  'toRef', 'toRefs', 'toRaw', 'unref', 'isRef', 'isReactive',
  'markRaw', 'triggerRef', 'customRef', 'effectScope', 'onScopeDispose', 'nextTick',
]

export const defines = {
  __VUE_OPTIONS_API__: 'false',
  __VUE_PROD_DEVTOOLS__: 'false',
  __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
}
