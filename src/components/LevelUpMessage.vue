<script setup vapor>
import { t, tx } from 'game/t'
import { REALMS } from 'game/realms'
import { format_number } from 'game/display'
import Rich from './Rich.vue'

// Message log entry for character.add_xp: {level_up: [record, ...]} or {bottleneck: tier}.
defineProps({ value: { type: Object, required: true } })

const BOTTLENECKS = {
  terra: { name: '大地级瓶颈', cls: 'realm_terra' },
  sky: { name: '天空级瓶颈', cls: 'realm_sky' },
  cloudy: { name: '云霄级瓶颈', cls: 'realm_cloudy' },
}

function realm_cls(realm) {
  if (realm >= 29) return 'realm_cloudy'
  if (realm >= 19) return 'realm_sky'
  if (realm >= 9) return 'realm_terra'
  return 'realm_basic'
}

const hl = (text, color) => ({ text: t(text), style: `color:${color}` })

function bottleneck(tier) {
  const b = BOTTLENECKS[tier]
  return tx`被${{ text: t(b.name), cls: b.cls }}限制 - 经验已锁定`
}

function header(lv) {
  return tx`${lv.name} 境界突破，达到 ${{ text: t(REALMS[lv.realm][1]), cls: realm_cls(lv.realm) }}`
}

// one entry per line, in the order the level-up used to print them
function lines(lv) {
  const out = [
    t`攻击提高了${format_number(lv.attack)}`,
    t`防御,敏捷提高了${format_number(lv.defense)}`,
    t`生命上限提高了${format_number(lv.max_health)}`,
  ]
  if (lv.attack_speed) out.push(t`小阶段突破，攻击速度额外增加${lv.attack_speed}`)
  if (lv.realm === 9) {
    out.push(
      tx`大境界突破，获取特殊能力${hl('【微火】', '#ff8080')}！`,
      tx`角色属性${hl('【普攻倍率】', '#66ccff')}现已解锁！`,
      t`心之境界一重 - 宝石吞噬者 现已解锁！`,
    )
  }
  if (lv.attack_mul) out.push(tx`${hl('普攻倍率', '#66ccff')}增加了${lv.attack_mul.toFixed(2)}`)
  if (lv.realm === 19) {
    if (!lv.realm_skill_ahead) out.push(t`大境界突破，【燃灼术】获取了9999兆经验！`)
    else out.push(t`大境界突破，【火灵幻海】获取了9999兆经验...?`, t`怎么领悟已经突破了哇。也太能刷了叭。`)
    out.push(
      tx`角色属性${hl('【幸运】', '#ffee11')}现已解锁！`,
      t`同时，【暴击】属性被浓缩了！`,
      t`【暴击概率】降低为四分之一，【暴击伤害】提高了四倍！`,
      t`心之境界二重 - 贪婪之神 现已解锁！`,
      t`基础时间流速: 6min -> 48min!`,
    )
  }
  if (lv.realm === 29) {
    if (!lv.realm_skill_ahead) out.push(t`大境界突破，【出云落月[领域四重]】获取了9999秭经验！`)
    else out.push(t`大境界突破，【出云落月[领域五重]】获取了9999秭经验...?`, t`怎么领悟已经突破了哇。也太能刷了叭。`)
    out.push(
      t`所有状态效果已清除！`,
      tx`角色属性${hl('【宝石软上限起始倍率(SCGV)】', '#ff11dd')}现已解锁！`,
      t`心之境界三重 - 信仰祭坛 现已解锁！`,
      t`基础时间流速: 48min -> 288min!`,
    )
  }
  if (lv.luck) out.push(tx`${hl('幸运', '#ffee11')}增加了${lv.luck.toFixed(2)}`)
  if (lv.scgv) out.push(tx`${hl('SCGV', '#ff11dd')}增加了${lv.scgv.toFixed(2)}`)
  out.push(t`技能经验倍率提高了${lv.skill_xp}%`, t`生命值完全恢复了`)
  return out
}
</script>

<template>
  <b v-if="value.bottleneck"><Rich :value="bottleneck(value.bottleneck)" /></b>
  <template v-else v-for="(lv, i) in value.level_up" :key="i">
    <Rich :value="header(lv)" /><br>
    <template v-for="(line, j) in lines(lv)" :key="j"><Rich :value="line" /><br></template>
  </template>
</template>
