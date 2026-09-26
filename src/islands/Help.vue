<script setup vapor>
import { onMounted, onUnmounted } from 'vue'
import { t } from 'game/t'
import { ui_state } from 'game/ui-state'
import HelpText from '../components/HelpText.vue'
import HelpList from '../components/HelpList.vue'
import { help_title, help_hint, help_sections } from '../components/help_content.js'

// The help dialog, opened from the bottom bar. Replaces the old help.html page.
function close() {
  ui_state.helpOpen = false
}

function on_key(event) {
  if (event.key === 'Escape' && ui_state.helpOpen) close()
}

onMounted(() => window.addEventListener('keydown', on_key))
onUnmounted(() => window.removeEventListener('keydown', on_key))
</script>

<template>
  <div v-if="ui_state.helpOpen" class="help_backdrop" @click.self="close">
    <div class="help_dialog" role="dialog" aria-modal="true" :aria-label="t(help_title)">
      <div class="help_header">
        <span class="help_title">{{ t(help_title) }}</span>
        <span class="help_hint">{{ t(help_hint) }}</span>
        <button type="button" class="help_close" :aria-label="t('关闭')" @click="close">X</button>
      </div>
      <div class="help_body">
        <details v-for="(section, i) in help_sections" :key="i" :class="{ help_separated: section.separated }">
          <summary><HelpText :value="section.title" /></summary>
          <div class="help_content">
            <p v-if="section.lines"><HelpText :value="section.lines" /></p>
            <HelpList v-if="section.items" :items="section.items" />
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help_backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}
.help_dialog {
  display: flex;
  flex-direction: column;
  width: min(900px, 94vw);
  max-height: 90vh;
  background-color: #05040f;
  background-image: var(--background_gradient);
  border: 4px solid blueviolet;
  color: white;
  font-size: 16px;
}
.help_header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  border-bottom: 1px solid gray;
}
.help_title {
  font-size: 22px;
  font-weight: bold;
}
.help_hint {
  flex: 1;
  color: lightgray;
}
.help_close {
  width: 40px;
  height: 40px;
  font-size: 24px;
  color: inherit;
  background: transparent;
  outline: 3px solid gray;
  border: none;
  cursor: pointer;
}
.help_body {
  overflow-y: auto;
  padding: 0 12px 12px;
}
summary {
  padding: 10px 6px;
  border-top: 1px solid gray;
  font-weight: bold;
  cursor: pointer;
}
summary:hover,
details[open] > summary {
  background-color: var(--active_button_color);
}
.help_separated > summary {
  border-top-width: 4px;
}
.help_content {
  padding: 0 12px 8px;
  line-height: 1.5;
}
.help_content :deep(ul) {
  margin: 4px 0;
  padding-left: 22px;
}
.help_content :deep(.help_icon) {
  height: 1.2em;
  vertical-align: middle;
}
.help_content :deep(a) {
  color: lightskyblue;
}
</style>
