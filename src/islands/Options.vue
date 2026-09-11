<script setup vapor>
import { computed, ref } from 'vue'
import { t, set_number_units, current_lang, set_lang, forced_en } from 'game/t'
import { options, game_state, load_backup, set_bgm_enabled } from 'game/main'
import { ui_state } from 'game/ui-state'
import { useHostVisibility } from '../components/useHostVisibility.js'

const root = ref(null)
const visible = computed(() => ui_state.optionsOpen)
useHostVisibility(root, visible)
const lang = computed(() => current_lang())
const langs = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
]

// Each row toggles one key on the reactive `options` object. `after` runs the
// side effect the old option_* function had beyond writing the flag.
const rows = [
  { key: 'uniform_text_size_in_action', label: '静音', after: on => set_bgm_enabled(!on) },
  { key: 'auto_return_to_bed', label: '在战败时回到床上' },
  { key: 'remember_message_log_filters', label: '保持日志过滤器' },
  { key: 'disable_combat_autoswitch', label: '开始战斗时不自动切出物品栏' },
  { key: 'option_combat_filter', label: '战斗日志过滤器[闪避/0伤/击杀]' },
  { key: 'option_format_change', label: '科学计数法[刷新以全部生效]' },
  { key: 'option_number_units_kmbt', label: '千位单位[KMBT]', after: on => set_number_units(on) },
]

function toggle(row, event) {
  options[row.key] = event.target.checked
  row.after?.(options[row.key])
}

function close() {
  ui_state.optionsOpen = false
}

const backup_label = computed(() => {
  if (!game_state.backup_date) return t('加载备份自动存档')
  const date = game_state.backup_date.replaceAll('_', ':')
  return t`加载自动存档 [${date}]`
})

function load_the_backup() {
  if (!game_state.backup_date) return
  const confirmation = prompt(t('这会加载你的备份存档，失去从那时以来的一切进度。一般不建议这么做，除非什么东西出bug了。这时请导出bug存档并联系作者。如果这就是你想要的，在下面打出"load"。'))
  if (confirmation === 'load' || confirmation === '"load"') load_backup()
  else console.log('Loading of the backup save was cancelled.')
}

function hard_reset() {
  const confirmation = prompt(t('这会删除你全部的进度，而你不得不从最开始玩起。如果这就是你想要的，在下面打出"reset"。'))
  if (confirmation === 'reset' || confirmation === '"reset"') {
    localStorage.removeItem('save data')
    window.location.reload()
  } else {
    console.log('Hard reset was cancelled.')
  }
}

const button = 'w-fit ml-[40px] mr-auto px-[10px] py-[10px] h-[20px] mt-[5px] text-center text-[20px] cursor-pointer'
</script>

<template>
  <div ref="root" class="relative left-[5px] text-[20px]">
    <div v-if="!forced_en" class="m-[10px] w-fit border-2 border-solid border-[gray] p-[3px] flex">
      <span
        v-for="item in langs"
        :key="item.id"
        class="cursor-pointer px-[6px] text-[20px] leading-none"
        :class="{ active_selection_button: lang === item.id }"
        @click="set_lang(item.id)"
      >{{ item.label }}</span>
    </div>
    <div v-for="row in rows" :key="row.key" class="m-[10px] w-fit border-2 border-solid border-[gray] p-[3px]">
      <input
        type="checkbox"
        :id="'options_' + row.key"
        class="outline outline-1 outline-black"
        :checked="!!options[row.key]"
        @change="toggle(row, $event)"
      />
      <label :for="'options_' + row.key">{{ t(row.label) }}</label>
    </div>
  </div>
  <div
    class="absolute left-[548px] top-[2px] w-[50px] h-[50px] text-center text-[40px] outline outline-3 outline-[gray] cursor-pointer z-3"
    @click="close"
  > X </div>
  <div
    :class="[button, game_state.backup_date ? 'text-white' : 'text-[gray] cursor-not-allowed bg-[#181818]']"
    :style="game_state.backup_date ? { backgroundImage: 'var(--options_gradient)' } : {}"
    @click="load_the_backup"
  >{{ backup_label }}</div>
  <div
    :class="[button, 'text-white']"
    :style="{ backgroundImage: 'var(--background_gradient)' }"
    @click="hard_reset"
  > {{ t('硬重置游戏') }} <i class="material-icons"> warning_amber </i> </div>
</template>
