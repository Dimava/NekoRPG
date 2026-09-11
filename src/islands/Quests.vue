<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { character } from 'game/character'
import { format_number, format_money } from 'game/display'
import { inf_combat, gem_consume, coin_consume, influ_consume } from 'game/main'

const soul = 'image/item/B9_soul.png'
const level = computed(() => character.xp.current_level)
const vp = computed(() => inf_combat.VP?.num ?? 0)
const mp = computed(() => inf_combat.MP ?? 0)
const inp = computed(() => inf_combat.InP ?? 0)

const vpColor = computed(() => {
  const lgVP = Math.log10(vp.value + 1)
  let R = 255, G = 255, B = 255
  if (lgVP <= 10) {
    R = B = Math.round(255 - lgVP * 25.5)
  } else if (lgVP <= 20) {
    R = Math.round((lgVP - 10) * 12.75)
    G = Math.round((20 - lgVP) * 12.75 + 127.5)
    B = Math.round((lgVP - 10) * 25.5)
  } else if (lgVP <= 30) {
    R = Math.round((lgVP - 10) * 12.75)
    G = 128
    B = 255
  }
  return `rgb(${R},${G},${B})`
})

const vpBonus = computed(() => format_number(Math.pow(vp.value + 1, 0.07) * 100 - 100))
const mpBonus = computed(() => format_number((Math.pow(mp.value + 1, 0.10) - 1) * 100))
const inpBonus = computed(() => format_number(0.5 * (Math.log10(inp.value + 1) ** 1.5)))
</script>

<template>
  <div id="quests_header">
    <b>{{ t('= 心之境界 =') }}</b>
  </div>
  <div id="quest_list">
    <template v-if="level <= 8">
      <span class="realm_terra">{{ t('大地级一阶') }}</span>{{ t('解锁心之境界 - 一重！') }}
    </template>
    <template v-else>
      <b><span :style="{ color: vpColor }">{{ t('宝石吞噬者') }}</span></b> - {{ t('吞噬宝石，提供全局技能经验加成') }}<br>
      <div id="gem_consumer" class="gem_consume_button" @click="gem_consume">{{ t('吞噬物品栏中全部宝石') }}</div>
      {{ t('当前吞噬价值点:') }}<span :style="{ color: vpColor }">{{ format_number(vp) }}</span>
      <br>({{ t('加成:') }}<span :style="{ color: vpColor }">{{ vpBonus }}%</span>)<br><br><br><br>
      <template v-if="level <= 18">
        <span class="realm_sky">{{ t('天空级一阶') }}</span>{{ t('解锁心之境界 - 二重！') }}
      </template>
      <template v-else>
        <b><span style="color:cyan">{{ t('贪婪之神') }}</span></b> - {{ t('献祭金钱，提供全局运气加成') }}<br>
        <div id="coin_consumer" class="coin_consume_button" @click="coin_consume">{{ t('献祭物品栏中宝钱以上货币') }}</div>
        {{ t('当前献祭金额:') }}<span style="color:cyan" v-html="format_money(mp * 1e12)"></span>
        <br>({{ t('加成:') }}<span style="color:cyan">{{ mpBonus }}%</span>)<br><br><br><br>
        <template v-if="level <= 28">
          <span class="realm_cloudy">{{ t('云霄级一阶') }}</span>{{ t('解锁心之境界 - 三重！') }}
        </template>
        <template v-else>
          <b><span style="color:#ff11dd">{{ t('信仰祭坛') }}</span></b> - {{ t('炼化影响力') }}<img :src="soul">，{{ t('延后宝石软上限') }}<br>
          <div id="influ_consumer" class="influ_consume_button" @click="influ_consume">{{ t('炼化1%的纳家影响力') }}</div>
          <span style="color:lightskyblue">{{ t('已炼化的影响力:') }}{{ format_number(inp) }}<img :src="soul"></span>
          <br>({{ t('加成 : ') }}<span style="color:#ff11dd">+{{ inpBonus }}</span>)<br><br><br><br>
        </template>
      </template>
    </template>
  </div>
</template>
