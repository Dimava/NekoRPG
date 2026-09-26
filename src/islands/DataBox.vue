<script setup vapor>
import { computed, ref } from 'vue'
import { character, get_hero_xp_gain, get_skills_overall_xp_gain } from 'game/character'
import { game_state, get_money } from 'game/main'
import { enemy_killcount } from 'game/enemies'
import { format_number } from 'game/display'
import { t } from 'game/t'
import { ui_state } from 'game/ui-state'
import { useHostVisibility } from '../components/useHostVisibility.js'

const kills = computed(() => Object.values(enemy_killcount).reduce((sum, n) => sum + (n || 0), 0))
const root = ref(null)
const visible = computed(() => ui_state.journalTab === 'data')
useHostVisibility(root, visible)

const entries = computed(() => [
  { name: t('基础等级经验获取:'), value: `x${format_number(get_hero_xp_gain())}` },
  { name: t('基础技能经验获取:'), value: `x${format_number(get_skills_overall_xp_gain())}` },
  { name: t('敌人击杀数:'), value: String(Math.round(kills.value)) },
  { name: t('合成成功数:'), value: String(Math.round(game_state.total_crafting_successes)) },
  { name: t('合成尝试数:'), value: String(Math.round(game_state.total_crafting_attempts)) },
])

// coin tier -> css class of the coin colour, matching money_coins()
const tiers = [
  { type: 1, unit: 'X', css: 'coin_moneyK' },
  { type: 2, unit: 'Z', css: 'coin_moneyM' },
  { type: 3, unit: 'D', css: 'coin_moneyB' },
  { type: 4, unit: 'B', css: 'coin_moneyT' },
  { type: 5, unit: 'U', css: 'coin_moneyQa' },
  { type: 6, unit: 'kU', css: 'coin_moneyQa' },
  { type: 7, unit: 'MU', css: 'coin_moneyQa' },
]
const amounts = [1, 10, 100]
</script>

<template>
  <div ref="root" v-show="visible" id="db-list" class="min-h-0">
    <div id="db-xp">
      <div
        v-for="entry in entries" :key="entry.name"
        class="data_entry box-border w-full flex"
      >
        <span class="min-w-0 flex-auto">{{ entry.name }}</span>
        <span class="box-border flex-none basis-[90px] text-right">{{ entry.value }}</span>
      </div>
    </div>

    <div id="db-bank" class="h-[235px]">
      <br><b>{{ t('燕岗银行 - 提现') }}</b><br>
      <div v-for="tier in tiers" :key="tier.type" class="data_entry box-border w-full">
        <span
          v-for="n in amounts" :key="n"
          class="coin relative left-1 inline-block w-12 cursor-pointer text-left text-[16px]"
          :class="tier.css"
          @click="get_money(tier.type, n)"
        >[{{ n }}{{ n < 100 ? ' ' : '' }}{{ tier.unit }}]</span>
      </div>
    </div>
  </div>
</template>
