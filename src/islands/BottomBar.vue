<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { save_progress, save_to_file, load_from_file, get_date, GetSaveRewards, inf_combat } from 'game/main'
import { current_game_time } from 'game/game-time'
import { ui_state } from 'game/ui-state'

function save() {
  save_progress()
}

function exportSave() {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([save_to_file()], { type: 'text/plain' }))
  a.download = `neko-rpg ${get_date()}.txt`
  GetSaveRewards()
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function load(event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => load_from_file(reader.result)
  reader.readAsText(file)
  event.target.value = ''
}

function openOptions() {
  ui_state.optionsOpen = !ui_state.optionsOpen
}

function openHelp() {
  ui_state.helpOpen = true
}

const exportHasReward = computed(() => {
  current_game_time.minute
  current_game_time.hour
  return Date.now() - (inf_combat.ST || 0) >= 3.6e6
})
</script>

<template>
  <div id="save_button" class="sl_button" @click="save">{{ t('保存') }}</div>
  <div id="save_to_file_button" class="sl_button" @click="exportSave">
    <span v-if="exportHasReward" class="rarity_antique"><b>{{ t('导出(奖励)') }}</b></span>
    <span v-else>{{ t('导出') }}</span>
  </div>
  <label id="load_from_file_button" class="sl_button" for="saved_file_input">{{ t('导入') }}</label>
  <input id="saved_file_input" type="file" accept="text/plain" @change="load" />
  <div id="options_button" class="game_info" @click="openOptions"><span><i class="material-icons">settings</i></span></div>
  <div id="changelog_button" class="game_info"><a href="changelog.html" target="_blank">V3.53b</a></div>
  <div id="play_count" class="pc_right">
    <img src="https://hitscounter.dev/api/hit?url=https%3A%2F%2Fbtly0711.github.io%2FNekoRPG%2F&label=&icon=hash&color=%23feb272&message=&style=flat&tz=PRC">
  </div>
  <div id="help_button" class="game_info" @click="openHelp"><span><i class="material-icons">help_outline</i></span></div>
  <span>{{ t('←帮助菜单！常见问题可以找到解答！') }}</span>
</template>
