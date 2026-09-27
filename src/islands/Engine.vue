<script setup vapor>
import { computed } from 'vue'
import {
  minigame_state, inf_combat,
  engine, engine_r, engine_f, engine_e, engine_l, changePistonStatus, changePistonMode,
} from 'game/main'
import { character } from 'game/character'
import { format_number } from 'game/display'
import { t } from 'game/t'

// The engine loop in main.js mutates inf_combat.FE every 5 ms; everything here is derived from it.
// style.css shows this box in place of the location and skills boxes while data-minigame="engine".

const FE = computed(() => inf_combat.FE)

const result_name = computed(() => FE.value.SF.num * 999.999 - FE.value.SF.ice < 0 ? '万载冰髓锭' : '冰原超流体')
const fruit_status = computed(() => FE.value.fruit == -1 ? t('未放入') : t`觉醒${(FE.value.fruit / 1e4).toFixed(4)}%`)
const environment = computed(() => `${FE.value.outer_temp.toFixed(0)}K / ${((FE.value.outer_temp / 240) ** 2 * 12).toFixed(2)}MPa`)
const has_domain = computed(() => ['焰海霜天[领域二重]', '焰海霜天[领域三重]'].includes(character.equipment.realm?.name))

const PISTON_MODES = { 0: '摸鱼ing', 1: '压缩内部气体', 2: '内部气体自由膨胀', 3: '向内部充入气体', 4: '释放内部气体' }
const PISTON_BUTTONS = [['piston_compress', 1, '压缩'], ['piston_expand', 2, '膨胀'], ['piston_fill', 3, '充气'], ['piston_defill', 4, '放气']]

const pressure = computed(() => {
  const p = FE.value.IA.pressure
  if (p <= 1e9) return `${(p / 1e3).toFixed(0)} kPa`
  if (p <= 1e12) return `${(p / 1e6).toFixed(0)} MPa`
  if (p <= 1e15) return `${(p / 1e9).toFixed(0)} GPa`
  if (p <= 1e18) return `${(p / 1e12).toFixed(0)} TPa`
  return `${(p / 1e17).toFixed(2)} TBar`
})

// gas color by temperature: 0K cyan, 240K white, 960K yellow, 2240K orange
function gas_color(temp, alpha) {
  const ti = Math.min(temp ** 0.5 / 15.4919, 3)
  if (ti <= 1) return `rgb(${Math.round(255 * ti)},255,255,${alpha})`
  return `rgb(255,${Math.round(Math.max(255 * (4 - ti) / 2, 0))},${Math.round(Math.max(255 * (2 - ti), 0))},${alpha})`
}
// fully clear at 1e4 mol/m³, opaque at 1e10
const gas_alpha = computed(() => Math.min(1, Math.max(0, Math.log10(FE.value.IA.num / FE.value.IA.volume / 1e4) / 6)).toFixed(3))
const volume_ratio = computed(() => FE.value.IA.volume / 30)

const heat_rate = computed(() => {
  const { SF, IA, IM, outer_temp, piston } = FE.value
  let heat = (outer_temp - SF.temp) * SF.surface / SF.num / IM.thickness * 0.001
  if (piston == 0) heat += 0.5 * (IA.temp - SF.temp) * ((IA.num * SF.num * 1e7) / (IA.num + SF.num * 1e7)) / (SF.num * 1e7)
  return heat
})
const ice_speed = computed(() => FE.value.SF.surface * 3.4764e-14 * Math.exp(2623.17 / FE.value.SF.temp))
const ice_time = computed(() => {
  const s = Math.max((FE.value.SF.num * 1000 - FE.value.SF.ice) / ice_speed.value, 0)
  if (s <= 60) return t`${s.toFixed(1)}秒`
  if (s <= 3600) return t`${(s / 60).toFixed(1)}分钟`
  if (s <= 86400) return t`${(s / 3600).toFixed(2)}小时`
  if (s <= 31557020) return t`${(s / 86400).toFixed(2)}天`
  return t`${(s / 31557020).toFixed(2)}年`
})

const SF_AMOUNTS = [[5, '+5'], [50, '+50'], [500, '+500'], [-1, '+ALL']]
const IM_AMOUNTS = [[10, '+10'], [100, '+100'], [-1, '+ALL'], [-2, '-ALL']]
const EXTRACT_AMOUNTS = [[5, '-5'], [50, '-50'], [500, '-500'], [-1, '-ALL']]
const PIXELATED = 'transform-origin: top left; image-rendering: pixelated; display: block;'
</script>

<template>
  <template v-if="minigame_state.open === 'engine'">
    <div id="engine_container">
      <div id="container_circle" :style="{ backgroundColor: gas_color(FE.SF.temp, '1.0') }"></div>
      <img :src="'image/spec/container.png'" :style="`transform: scale(1.6); ${PIXELATED}`">
    </div>
    <div id="engine_container_stats">
      <b>
        <span style="color:rgb(154, 255, 255)">
          {{ t('冰原超流体') }} : {{ FE.SF.num }} m³ / {{ FE.SF.surface.toFixed(2) }} m²
          <span v-for="[n, label] in SF_AMOUNTS" :key="n" class="money_button" @click="engine(1, n)">[{{ label }}]</span>
        </span><br>
        <span style="color:rgb(94, 255, 207)">
          {{ t('温度 :') }} {{ FE.SF.temp.toFixed(1) }} K ( {{ heat_rate.toFixed(2) }} K/s)
        </span><br>
        <span style="color:rgb(94, 183, 255)">
          {{ t('多孔冰晶 :') }} {{ FE.IM.num }} pts / {{ FE.IM.thickness.toFixed(4) }} m
          <span v-for="[n, label] in IM_AMOUNTS" :key="n" class="money_button" @click="engine(2, n)">[{{ label }}]</span>
        </span><br>
        <span style="color:rgb(94, 124, 255)">
          {{ t('冰元素 :') }} {{ format_number(FE.SF.ice) }} / {{ format_number(FE.SF.num * 1000) }} pts ({{ ice_speed.toFixed(2) }}pts/s) <br>
          <div id="engine_element_bar_max">
            <div id="engine_element_bar_current" :style="{ width: `${Math.min(FE.SF.ice / (FE.SF.num * 10), 100).toFixed(1)}%` }"></div>
          </div>
          {{ t('预计时间 :') }} {{ ice_time }}.
        </span><br>
      </b>
    </div>

    <div id="engine_result_stats">
      <b>
        <span style="color:rgb(0, 255, 255)">
          {{ t('提取 [') }}{{ t(result_name) }}] : <br>
          <span v-for="[n, label] in EXTRACT_AMOUNTS" :key="n" class="money_button" @click="engine_r(1, n)">[{{ label }}]</span>
        </span><br>
        <span style="color:cyan; -webkit-text-stroke:0.5px blue">
          {{ t('玄冰果实 :') }} {{ fruit_status }}
          <span class="money_button" @click="engine_f(1)">{{ t('[放入]') }}</span>
          <span class="money_button" @click="engine_f(2)">{{ t('[取出]') }}</span>
        </span><br>
        <span style="color:rgb(94, 183, 255)">
          {{ t('环境 :') }} {{ environment }}<br>
          <span class="money_button" style="color:rgb(209, 255, 240)" @click="engine_e(240)">{{ t('[冰原]') }}</span>
          <template v-if="has_domain">
            <span id="engine_env1" class="money_button" style="color:rgb(255, 94, 0)" @click="engine_e(960)">{{ t('[焰海]') }}</span>
            <span id="engine_env2" class="money_button" style="color:rgb(20, 228, 255)" @click="engine_e(180)">{{ t('[霜天]') }}</span>
          </template>
        </span><br>
        <span style="background: linear-gradient(to bottom right,cyan,white,cyan);background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;" @click="engine_e(-1)">{{ t('[将飞船之心转化为材料版]') }}</span><br>
      </b>
    </div>
    <div id="engine_piston" :style="{ left: `${Math.round(120 * (1 + Math.cos(Math.PI * (1 + FE.piston))) + 64)}px` }">
      <div id="container_square" :style="{ width: `${Math.round(100 * volume_ratio)}px`, backgroundColor: gas_color(FE.IA.temp, gas_alpha) }"></div>
      <div id="piston_pt1">
        <img :src="'image/spec/piston_pt1.png'" :style="`transform: scale(1.2); ${PIXELATED}`">
      </div>
      <div id="piston_pt2" :style="{ left: `${Math.round(10 + 100 * volume_ratio)}px` }">
        <img :src="'image/spec/piston_pt2.png'" :style="`transform: scale(1.2); ${PIXELATED}`">
      </div>
      <div id="piston_buttons">
        <div v-for="[id, mode, label] in PISTON_BUTTONS" :key="id" :id="id" @click="changePistonMode(mode)">{{ t(label) }}</div>
      </div>
      <div id="piston_stats">
        <b>
          <span style="color:antiquewhite">{{ t('活塞工作状态 :') }} {{ t(PISTON_MODES[FE.piston_mode]) }}</span><br>
          <span style="color:lightskyblue">{{ t('内部气体温度 :') }} {{ FE.IA.temp.toFixed(2) }} K</span><br>
          <span style="color:pink">{{ t('内部气体压强 :') }} {{ pressure }}</span><br>
          <span style="color:lemonchiffon">{{ t('冰原空气体积 :') }} {{ FE.IA.volume.toFixed(3) }} / 30.000 m³</span><br>
          <span style="color:lightsalmon">{{ t('喵可做功功率 :') }} {{ (character.stats.full.attack_power ** 1.5 / 1e9).toFixed(1) }} GW</span><br>
        </b>
      </div>
    </div>
    <div id="piston_change" @click="changePistonStatus()"><i class="material-icons">sync</i>{{ t('移动活塞') }}</div>
    <div id="leave_engine" @click="engine_l()"><i class="material-icons">directions</i>{{ t('离开极寒相变引擎') }}</div>
  </template>
</template>
