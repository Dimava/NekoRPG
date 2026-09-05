// Only new UI components are compiled. Existing NekoRPG modules remain
// browser-native ES modules outside the island build.
export const internals = ['./src/components', './src/islands']
export const outDir = 'ui'

// These aliases resolve to the game's existing files at their existing URLs.
// They are never copied, transformed, or bundled.
export const imports = {
  'game/game-time': { source: 'src/game_time.js', url: './src/game_time.js' },
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
