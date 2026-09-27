<script setup vapor>
import { computed, onScopeDispose, watchEffect } from 'vue'
import {
  minigame_state, minigame_elements, inf_combat, global_flags,
  leave_grass, leave_digging, claw_use, filter_up, filter_down, digging_t,
  reactor, leave_reactor, extract_reactor, extract_evolve,
} from 'game/main'
import { character } from 'game/character'
import { format_number } from 'game/display'
import { t } from 'game/t'

// The game loops stay imperative in main.js and publish their numbers into minigame_state;
// this island only draws them. The grass field is a canvas that main.js paints itself.

const open = computed(() => minigame_state.open)

// style.css swaps whole boxes for the engine, which has its own island in #engine_div
watchEffect(() => {
  if (open.value) document.documentElement.dataset.minigame = open.value
  else delete document.documentElement.dataset.minigame
})

onScopeDispose(() => {
  minigame_elements.pond = null
  minigame_elements.grass_canvas = null
})

const bar_style = health => ({
  height: `${health.toFixed(0)}%`,
  top: `${(100 - health).toFixed(0)}%`,
  background: `rgb(${Math.min((100 - health) * 5.1, 255)},${Math.min(health * 5.1, 255)},0)`,
})
const fish_font = ['少', '女', '钓', '鱼', '中']

// reactor readouts, derived from inf_combat.RT as the loop mutates it
const RT = computed(() => inf_combat.RT)
const log_bar = x => `${Math.log10(Math.min(x, 9999) + 1) * 25}%`
const cores = computed(() => [
  { key: 'B1', id: 1, label: 'B1·能量核心', color: '#CFFEE3', value: RT.value.B1 },
  { key: 'A7', id: 2, label: 'A7·能量核心', color: '#FBD6FB', value: RT.value.A7 },
  { key: 'LD', id: 3, label: '雷电加护', color: '#0066FF', value: RT.value.LD },
  { key: 'ER', id: 4, label: '高能凝胶', color: '#808080', value: RT.value.ER },
])
const core_diff = computed(() => {
  const { B1, A7, power } = RT.value
  return {
    B1: `${t('消耗:')}${format_number(Math.log10(B1 + 1) * 0.4 * power / 8000)}/s ${t('临界度:')}${format_number(Math.log10(B1 + 1) * 40)}%`,
    A7: `${t('消耗:')}${format_number(Math.sqrt(A7 * power) * 0.4 / 20)}/s`,
  }
})
const temp_diff = computed(() => {
  const { temp, power, ER } = RT.value
  const cooling = (temp - ((temp - 20) * (1 - (0.03 / ((100 * ER) ** 0.333))) + 20)) / 0.03
  return `(+${format_number(power * 100 / ER)}/s,-${format_number(cooling)}/s)`
})
const reactor_amounts = [[1, '+1'], [10, '+10'], [100, '+100'], [1000, '+1K']]

// grass
const harvested = computed(() => character.inventory['{"id":"绝音蕨"}']?.count ?? 0)

// digging
const deg = angle => angle * 360 / 6.283
</script>

<template>
  <div v-if="open === 'fishing'" id="fish_div">
    <div id="fish_background_div">
      <div id="neko_fish_div">
        <img :src="'image/spec/neko.png'">
        <div id="fish_progress_div">
          <div id="fish_progress_bar" :style="bar_style(minigame_state.fishing.health)"></div>
        </div>
        <div id="fish_mark_div"><img :src="'image/spec/fishmark.png'"></div>
      </div>
      <div id="fish_minigame_div">
        <div id="fish_rod_div" :style="{ bottom: `${minigame_state.fishing.rod_bottom}px`, height: `${minigame_state.fishing.rod_length}px` }"></div>
        <div id="fish_game_div" :style="{ bottom: `${minigame_state.fishing.fish_bottom}px` }"><img :src="'image/spec/fishmark.png'"></div>
      </div>
    </div>
    <div id="fish_font_div">
      <template v-for="(char, i) in fish_font" :key="i">
        <span :style="{ paddingLeft: `${i * 1.5}em` }">{{ t(char) }}</span><br><br>
      </template>
      <span :style="{ paddingLeft: '7.5em' }">...</span>
    </div>
  </div>

  <div v-if="open === 'fishing_changed'" id="fish_changed_div">
    <div id="fish_background_changed_div">
      <div id="neko_fish_changed_div">
        <img :src="'image/spec/neko.png'">
        <div id="fish_progress_changed_div">
          <div id="fish_progress_changed_bar" :style="bar_style(minigame_state.fishing_changed.health)"></div>
        </div>
        <div id="fish_mark_changed_div"><img :src="'image/spec/fishmark.png'"></div>
      </div>
      <div id="fish_minigame_changed_div" :ref="el => (minigame_elements.pond = el)">
        <div id="fish_rod_changed_div" :style="{
          bottom: `${minigame_state.fishing_changed.rod_bottom}px`,
          left: `${minigame_state.fishing_changed.rod_left}px`,
          width: `${minigame_state.fishing_changed.rod_length}px`,
          height: `${minigame_state.fishing_changed.rod_length}px`,
        }"></div>
        <div id="fish_rod_2nd_div" :style="{
          bottom: `${minigame_state.fishing_changed.rod_bottom - minigame_state.fishing_changed.rod_length * 0.3}px`,
          left: `${minigame_state.fishing_changed.rod_left - minigame_state.fishing_changed.rod_length * 0.3}px`,
          width: `${minigame_state.fishing_changed.rod_length * 1.6}px`,
          height: `${minigame_state.fishing_changed.rod_length * 1.6}px`,
        }"></div>
        <div id="fish_game_changed_div" :style="{
          bottom: `${minigame_state.fishing_changed.fish_bottom}px`,
          left: `${minigame_state.fishing_changed.fish_left}px`,
        }"><img :src="'image/spec/fishmark.png'"></div>
      </div>
    </div>
  </div>

  <div v-if="open === 'reactor'" id="reactor_div">
    <div id="reactor_info_div">
      <b>{{ t('= 核心反应堆 =') }} </b> {{ t('超高品质凝胶剑柄的最佳选择！') }}<br>
      <span style="color:red">{{ t('警告：反应堆温度达到9999°C时会熔毁,摧毁其中的一切.') }}</span><br>
    </div>
    <div v-for="core in cores" :key="core.key" :id="`${core.key}_core_div`">
      <div :id="`reactor_${core.key}_bar_max`">
        <div :id="`reactor_${core.key}_bar_current`" :style="{ width: log_bar(core.value) }"></div>
      </div>
      <span :style="{ color: core.color }">
        <b>{{ t(core.label) }}</b>:<span>{{ format_number(core.value) }}</span>
        <template v-if="core_diff[core.key]"> <span>{{ core_diff[core.key] }}</span><br></template>
        <span v-for="[n, label] in reactor_amounts" :key="n" class="money_button" @click="reactor(core.id, n)">[{{ label }}]</span>
      </span>
      <br v-if="!core_diff[core.key]">
    </div>

    <div id="temp_div">
      <div id="temp_bar_max">
        <div id="temp_bar_current" :style="{ width: `${100 - RT.temp / 100}%` }"></div>
      </div>
      <span style="color:#ffb0b0">
        <b>{{ t('反应堆温度') }} </b>:<span>{{ format_number(RT.temp) }}</span>°C <span>{{ temp_diff }}</span>
      </span>
      <br>
    </div>
    <div id="rad_div">
      <div id="rad_bar_max">
        <div id="rad_bar_current" :style="{ width: `${100 - Math.log(Math.min(RT.rad, 1202604) + 1) * 100 / 14}%` }"></div>
      </div>
      <span style="color:#d0ffc0">
        <b>{{ t('总吸收原能') }} </b>:<span>{{ format_number(RT.rad) }}</span>
        <span>(+{{ format_number(RT.power) }}/s)</span>
        ({{ t('品质:') }}<span>{{ format_number(Math.log(RT.rad + 1) * 15 + 100) }}</span>%)
      </span>
      <br>
    </div>

    <div id="reactor_exit">
      <span class="money_button_wide" style="color:#808080" @click="extract_reactor()"><b>{{ t('[提取凝胶剑柄]') }}</b></span>
      <span v-if="global_flags.is_evolve_studied" id="reactor_evolve" class="money_button_wider" style="color:#80FF80" @click="extract_evolve()"><b>{{ t('[凝聚进化结晶(100万原能)]') }}</b></span>
      <span class="money_button" @click="leave_reactor()"><b>{{ t('[离开]') }}</b></span>
    </div>
  </div>

  <div v-if="open === 'grass'" id="grass_div">
    <div id="grass_info_div">
      <b>{{ t('= 绝音蕨 =') }} </b> {{ t('Tier 16内甲与轮芯的必需品！') }} <br>
      <span style="color:lime">{{ t('小概率获取噬芒兰！概率与收割技能相关.') }}</span><br>
    </div>
    <div id="grass_stat_div">
      <span style="font-size:large;color:#c0ffc0;left:10px"><b>
        {{ inf_combat.GR.grass.size.toFixed(0) }} / {{ inf_combat.GR.grass_cap.toFixed(0) }}
        ({{ minigame_state.grass.timer.toFixed(2) }} / {{ minigame_state.grass.timer_cap.toFixed(2) }} s)
        ~ {{ t('已收割') }}:{{ harvested.toFixed(0) }}
      </b></span>
    </div>
    <div id="grassfield_div">
      <canvas id="grassCanvas" width="384" height="320" :ref="el => (minigame_elements.grass_canvas = el)"></canvas>
    </div>
    <div id="grass_exit">
      <span class="money_button" @click="leave_grass()"><b>{{ t('[离开]') }}</b></span>
    </div>
  </div>

  <div v-if="open === 'digging'" id="digging_div">
    <div id="digging_info_div">
      <b>{{ t('= 地层钻探 =') }}</b> {{ t('瞄准宝藏鱼,点击纳可驱动钩爪,抓上来!') }}<br>
      <span style="color:chartreuse">{{ t('忽略低阶宝藏鱼 :') }} <span>{{ inf_combat.DF }}</span> {{ t('阶↓') }} <span @click="filter_down()">[-]</span><span @click="filter_up()">[+]</span></span>
      <span style="background: linear-gradient(to bottom right,cyan,lime,yellow);background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;" @click="digging_t()"><b>{{ t('[将幻境之心转化为材料版]') }}</b></span><br>
      <span class="money_button" @click="leave_digging()"><b>{{ t('[离开]') }}</b></span>
    </div>
    <div id="digging_neko_div">
      <img :src="'image/spec/neko.png'" @click="claw_use()">
    </div>
    <div id="claw_line" :style="{
      transform: `rotate(${deg(minigame_state.digging.claw_angle) + 90}deg)`,
      width: `${minigame_state.digging.claw_length + 4}px`,
    }"></div>
    <img id="digging_claw" :src="'image/spec/claw.png'" :style="{
      transformOrigin: 'left top',
      transform: `rotate(${deg(minigame_state.digging.claw_angle) + 45}deg)`,
      top: `${91 + minigame_state.digging.claw_y}px`,
      left: `${minigame_state.digging.claw_x}px`,
    }">
    <div id="digging_field_div">
      <div v-for="fish in minigame_state.digging.fish" :key="fish.id" class="digging_fish"
        :style="{ position: 'absolute', top: `${fish.top}px`, left: `${fish.left}px` }">
        <img :src="`image/spec/fishmark_loot${fish.tier}.png`">
      </div>
      <div v-if="minigame_state.digging.caught" class="digging_fish" :style="{
        position: 'absolute',
        top: `${minigame_state.digging.caught.top}px`,
        left: `${minigame_state.digging.caught.left}px`,
        transformOrigin: 'center',
        transform: `rotate(${deg(minigame_state.digging.claw_angle) - 45}deg)`,
      }">
        <img :src="`image/spec/fishmark_loot${minigame_state.digging.caught.tier}.png`">
      </div>
    </div>
  </div>
</template>
