<script setup vapor>
import { ref, watch, nextTick } from 'vue'
import { t } from 'game/t'
import { messages } from 'game/display'
import { message_log_filters } from 'game/main'
import Tabs from '../components/Tabs.vue'

const box = ref(null)
const filters = [
  { id: 'unlocks', label: '升级 & 解锁' },
  { id: 'events', label: '_事件_' },
  { id: 'crafting', label: '_合成_' },
  { id: 'combat', label: '_战斗_' },
  { id: 'loot', label: '_掉落_' },
  { id: 'background', label: '背景信息' },
]

function toggle(id) {
  message_log_filters[id] = !message_log_filters[id]
}

watch(() => messages.at(-1)?.id ?? 0, async () => {
  const el = box.value
  if (!el) return
  const stick = el.scrollHeight - el.scrollTop < 1000
  await nextTick()
  if (stick) el.scrollTop = el.scrollHeight
}, { flush: 'pre' })
</script>

<template>
  <div ref="box" id="message_box_div">
    <div
      v-for="msg in messages"
      v-show="message_log_filters[msg.filter]"
      :key="msg.id"
      class="message_common"
      :class="[msg.style, msg.group]"
    >
      <span v-html="msg.text"></span>
      <div class="message_border"></div>
    </div>
  </div>
  <Tabs id="message_controls">
    <button
      v-for="f in filters"
      :key="f.id"
      type="button"
      class="tab"
      :aria-pressed="!!message_log_filters[f.id]"
      :class="{
        'tab-active': message_log_filters[f.id],
        active_selection_button: message_log_filters[f.id],
      }"
      @click="toggle(f.id)"
    >{{ t(f.label) }}</button>
  </Tabs>
</template>

<style scoped>
#message_controls {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  position: relative;
  z-index: 1;
}
/* Beat Tabs.vue `.tabs > * { background: transparent }` on slotted buttons. */
#message_controls .tab {
  appearance: none;
  cursor: pointer;
  color: inherit;
}
#message_controls .tab.tab-active,
#message_controls .tab.active_selection_button {
  background-color: var(--active_button_color);
}
</style>
