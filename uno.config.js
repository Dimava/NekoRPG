import { defineConfig, presetWind4 } from 'unocss'

export default defineConfig({
  presets: [presetWind4({ preflights: { reset: false } })],
  content: { filesystem: ['index.html', 'en.html', 'src/islands/**/*.vue', 'src/components/**/*.vue'] },
  theme: {
    colors: {
      tooltip: 'var(--tooltip_background_color)',
    },
  },
})
