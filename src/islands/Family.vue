<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { current_game_time } from 'game/game-time'
import { format_number, format_money } from 'game/display'
import { family_data, global_flags, realm_rate, get_baby_cost, get_time_passed } from 'game/main'

const ALI = [
  { value: 1, label: '[1]常规工作' },
  { value: 2, label: '[2]家族试炼' },
  { value: 3, label: '[3]秘境探险' },
  { value: 4, label: '[4]战场厮杀' },
  { value: 5, label: '[5]九死一生' },
]


const soul = 'image/item/B9_soul.png'
const enabled = computed(() => !!global_flags.is_family_enabled)

const re_time = computed(() => 10800 - (current_game_time.hour * 60 + current_game_time.minute))
const timer_game = computed(() => Math.floor(re_time.value / 60) + 'h' + re_time.value % 60 + 'm')
const timer_real = computed(() => Math.ceil(re_time.value / get_time_passed()) + 's')

const rows = computed(() => {
  const mem = family_data.mem
  const out = []
  for (let r = 0; r <= 99; r++) {
    if (mem[r]?.vis) out.push(r)
  }
  return out
})

function format_mem_change(mem_data) {
  if (mem_data > 0) return format_number(mem_data)
  if (mem_data == 0) return 'N/A'
  return mem_data + 'd'
}

function set_baby(event) {
  const value = event.target.value
  family_data.baby = Number(value) != Number(value) ? 0 : value
}

function set_ali(r, event) {
  family_data.mem[r].ali = Number(event.target.value)
}
</script>

<template>
  <span v-show="!enabled" id="family_locked">
    {{ t('家族系统~纳可现在还不是家主！') }}<br>
    <span v-html="t`通过<b>区域 3 - 7</b>后击败<span class='realm_cloudy'>纳布(宝库)</span>解锁！`"></span>
  </span>
  <div v-show="enabled" id="family_system">
    <span style="color:lightyellow">⌚️{{ t('下一血洛日:') }}</span> <span id="family_timer_game">{{ timer_game }}</span> ( {{ t('现实') }} <span id="family_timer_real">{{ timer_real }}</span> )<br>
    <span style="color:lightcyan">{{ t('次日') }}<span class="realm_basic">{{ t('微尘级初级') }}</span>{{ t('新生儿数 : ') }}</span>
    <input type="text" id="baby_born_num" :value="family_data.baby" @change="set_baby"><br>
    <span style="color:lightcoral">{{ t('每日养育耗费 : ') }}</span><span id="family_baby_cost" v-html="format_money(get_baby_cost(family_data.baby))"></span><br>
    <span v-if="family_data.baby > 1e4" style="color:yellow" id="baby_scale1">{{ t('新生儿超过1万，花费受到一重软上限限制(^1.5)') }}<br></span>
    <span v-if="family_data.baby > 1e8" style="color:orange" id="baby_scale2">{{ t('新生儿超过1亿，花费受到二重软上限限制(^1.75)') }}<br></span>
    <span v-if="family_data.baby > 1e12" style="color:red" id="baby_scale3">{{ t('新生儿超过1兆，花费受到三重软上限限制(^2.0)') }}<br></span>
    <span style="color:lightskyblue">{{ t('纳家影响力:') }}<span id="family_influ">{{ format_number(family_data.influ) }}</span><img :src="soul">( <span id="family_re_influ">{{ format_number(family_data.re_influ) }}</span><img :src="soul">/d)</span>
    <br><br>
    <table id="family_member_list">
      <tr class="stance_list_entry member_list_header">
        <th class="member_list_header member_list_realm">{{ t('境界') }}</th>
        <th class="member_list_header member_list_num">{{ t('人数') }}</th>
        <th class="member_list_header member_list_change" style="color:lightgreen">{{ t('突破') }}</th>
        <th class="member_list_header member_list_change" style="color:lightcoral">{{ t('死亡') }}</th>
        <th class="member_list_header member_list_alti">{{ t('培养策略') }}</th>
      </tr>
      <tr v-for="r in rows" :key="r" class="stance_list_entry">
        <td class="member_list member_list_realm" :class="realm_rate[r][4]">{{ t(realm_rate[r][3]) }}</td>
        <td class="member_list member_list_num" :class="realm_rate[r][4]">{{ format_number(family_data.mem[r].num) }}</td>
        <td class="member_list member_list_change" style="color:lightgreen"><b>{{ format_mem_change(family_data.mem[r].break) }}</b></td>
        <td class="member_list member_list_change" style="color:lightcoral"><b>{{ format_mem_change(family_data.mem[r].die) }}</b></td>
        <td class="member_list member_list_change">
          <select :id="(r <= 9 ? '0' : '') + r + '_family_ali'" class="family_ali" :value="family_data.mem[r].ali" @change="set_ali(r, $event)">
            <option v-for="opt in ALI" :key="opt.value" :value="opt.value">{{ t(opt.label) }}</option>
          </select>
        </td>
      </tr>
    </table>
  </div>
</template>
