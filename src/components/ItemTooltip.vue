<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { format_number, capitalize_first_letter, format_money, describe_effect, format_rewards } from 'game/display'
import { item_templates, book_stats, rarity_multipliers, getItemRarity, ScaledQualityMultiplier, round_item_price } from 'game/items'
import { stat_names } from 'game/misc'
import { character } from 'game/character'
import { traders } from 'game/traders'
import { trade_state } from 'game/trade'
import { REALMS } from 'game/realms'

// Port of create_item_tooltip_content (display.js). Same text, same order,
// built as lines of parts instead of an HTML string.
// options: { quality: [q] | [q0, q1], skip_quality, trader }
const props = defineProps({
  item: { type: Object, required: true },
  options: { type: Object, default: () => ({}) },
})

const no_quality_slots = ['props', 'method', 'special', 'realm']
const skill_level_names = { Mining: '挖掘', Woodcutting: '砍伐', Fishing: '钓鱼' }
const slot_names = { sword: '剑', head: '头部', trident: '三叉戟', moonwheel: '月轮', torso: '躯干', legs: '腿部', feet: '脚部', pickaxe: '镐子', axe: '斧子', sickle: '镰刀', props: '道具', method: '秘法', special: '特殊', realm: '领域' }
const equip_stat_names = { 'Defense': '防御', 'Attack power': '攻击', 'Attack speed': '攻速', 'Agility': '敏捷', 'Crit rate': '暴率', 'Max health': '生命', 'Attack mul': '普攻倍率', 'Crit multiplier': '爆伤', 'Health regeneration_flat': '生命恢复', 'Health regeneration_percent': '生命恢复[%]', 'Luck': '幸运', 'SCGV': '宝石耐性' }

const labels = { quality: '品质:', type: '类型:', slot: '槽位:', none: '无', attack: '攻击:', defense: '防御:', realm_limit: '限制境界:', and_below: '及以下', effect: '效果', base_stats: '基础属性:', expected_stats: '预期属性:', attack_power: '攻击力:', defense_power: '防御力:', current_efficiency: '当前效率:' }
const L = key => t(labels[key])
const equip_stat_name = key => t(equip_stat_names[capitalize_first_letter(key).replace('_', ' ')] ?? key)
const sign = n => (n > 0 ? '+' : '')

function gem_efficiency(current_value, gem_value, scgv, stat_multiplier = 1) {
  const softcap = gem_value * scgv * stat_multiplier
  if ((current_value || 0) < softcap) return 1
  const x = (current_value || 0) / softcap
  return Math.exp(-5 * (x + 1 - 2 * Math.sqrt(x)))
}

const lines = computed(() => {
  const item = props.item
  const options = props.options ?? {}
  const out = []
  const line = (...parts) => out.push(parts.map(p => (typeof p === 'string' ? { text: p } : p)))
  const blank = () => out.push([])
  const rarity = q => 'rarity_' + item.getRarity(q)
  const two = !options.skip_quality && options.quality?.length == 2
  const title = typeof item.getNameParts === 'function'
    ? item.getNameParts().map(part => t(part)).join(' ')
    : t(item.getName())
  line({ text: title, b: true })
  if (item.description) line({ text: t(item.getDescription()), html: true })

  let quality = options.quality?.[0] ?? item.quality

  const quality_block = () => {
    blank()
    if (two) {
      line({ text: L('quality'), b: true }, { text: ` ${options.quality[0]}% `, cls: rarity(options.quality[0]), b: true }, { text: ' - ', b: true }, { text: ` ${options.quality[1]}% `, cls: rarity(options.quality[1]), b: true })
    } else {
      line({ text: t`品质: ${quality}%`, cls: rarity(quality), b: true })
    }
  }

  if (item.item_type === 'EQUIPPABLE') {
    if (!no_quality_slots.includes(item.equip_slot)) quality_block()

    const levels = Object.entries(item.bonus_skill_levels ?? {}).filter(([, n]) => n > 0)
    if (levels.length) {
      blank()
      for (const [name, n] of levels) line(`${t(skill_level_names[name] ?? name)}: +${n}`)
    }

    if (item.equip_slot === 'weapon') {
      blank()
      line(L('type'), ' ', { text: t(slot_names[item.weapon_type] ?? item.weapon_type), b: true })
    } else if (item.offhand_type !== 'shield') {
      blank()
      line(L('slot'), ' ', { text: t(slot_names[item.equip_slot] ?? item.equip_slot), b: true })
    }

    if (item.components) {
      const keys = Object.keys(item.components)
      let text = `[${t(item_templates[item.components[keys[0]]].getName())}]`
      text += item.components[keys[1]] ? `+[${t(item_templates[item.components[keys[1]]].getName())}]` : `+ ${L('none')} [${t(keys[1])}]`
      blank()
      line({ text, cls: 'item_component_list' })
    }

    if (two) {
      const [q0, q1] = options.quality
      if (item.getAttack) {
        blank()
        line(`${L('attack')} ${format_number(item.getAttack(q0))}-${format_number(item.getAttack(q1))}`)
      } else if (item.getDefense) {
        blank()
        line(`${L('defense')} ${format_number(item.getDefense(q0))}-${format_number(item.getDefense(q1))}`)
      } else if (item.offhand_type === 'shield') {
        const block = character.stats.total_multiplier.block_strength
        blank()
        line(`Can block up to: ${Math.round(10 * item.getShieldStrength(q0) * block) / 10}-${Math.round(10 * item.getShieldStrength(q1) * block) / 10} damage [base: ${item.getShieldStrength(q0)}-${item.getShieldStrength(q1)}]`)
      }
      const s0 = item.getStats(q0)
      const s1 = item.getStats(q1)
      if (Object.keys(s0).length) blank()
      for (const key of Object.keys(s0)) {
        if (s0[key].flat != null) line(`${equip_stat_name(key)}: +${format_number(s0[key].flat)}-${format_number(s1[key].flat)}`)
        if (s0[key].multiplier != null) line(`${equip_stat_name(key)}: x${format_number(s0[key].multiplier)}-${format_number(s1[key].multiplier)}`)
      }
    } else {
      if (item.getAttack) {
        blank()
        line(`${L('attack')} ${format_number(item.getAttack())}`)
      } else if (item.getDefense && !no_quality_slots.includes(item.equip_slot)) {
        blank()
        line(`${L('defense')} ${format_number(item.getDefense())}`)
      } else if (item.offhand_type === 'shield') {
        const block = character.stats.total_multiplier.block_strength
        blank()
        line(`Can block up to: ${Math.round(10 * item.getShieldStrength() * block) / 10} damage [base: ${item.getShieldStrength()}]`)
      }
      const stats = item.getStats()
      if (Object.keys(stats).length) blank()
      for (const key of Object.keys(stats)) {
        if (stats[key].flat != null) line(`${equip_stat_name(key)}: ${sign(stats[key].flat)}${format_number(stats[key].flat)}`)
        if (stats[key].multiplier != null) line(`${equip_stat_name(key)}: x${format_number(stats[key].multiplier)}`)
      }
    }
  } else if (item.item_type === 'USABLE') {
    blank()
    if (item.gem_value > 0) {
      const gem_value = item.gem_value
      const scgv = character.stats.full.SCGV || 1
      let health_multiplier = gem_value > 7500 ? 100 : 50
      if (gem_value > 7500e4) health_multiplier *= 2
      const gems = character.stats.flat.gems ?? {}
      const efficiency = (value, multiplier) => `${format_number(gem_efficiency(value, gem_value, scgv, multiplier) * 100)}%`

      line({ text: L('current_efficiency'), b: true })
      line(`${t('攻击')}: ${efficiency(gems.attack_power)}`)
      if (!item.getName().includes('剑')) {
        line(`${t('防御')}: ${efficiency(gems.defense)}`)
        line(`${t('敏捷')}: ${efficiency(gems.agility)}`)
        line(`${t('生命')}: ${efficiency(gems.max_health, health_multiplier)}`)
      }
      blank()
    }
    if (item.realmcap != -1) {
      const realm = REALMS[item.realmcap]
      line(L('realm_limit'), ' ', { text: t(realm[1]), cls: `realm_${realm[5]}` }, ' ', L('and_below'))
      blank()
    }
    if (item.effects.length) line(`${L('effect')}: `)
    for (const { effect: name, duration } of item.effects) {
      const effect = describe_effect(name)
      line({ text: t`'${t(effect.name)}' : `, cls: 'active_effect_name' }, { text: `${duration}s`, cls: 'active_effect_duration' })
      for (const stat of effect.stats) line(` ${t(stat.name)} : ${stat.value}`)
    }
  } else if (item.item_type === 'BOOK') {
    blank()
    if (!book_stats[item.name].is_finished) line(`Time to read: ${item.getRemainingTime()} minutes`)
    else {
      line(`Reading it provided ${character.name} with:`)
      line({ text: ` ${format_rewards(book_stats[item.name].rewards)}`, html: true })
    }
  } else if (item.tags?.component) {
    quality_block()
    if (item.component_tier) line(t`部件等级: ${item.component_tier}`)
    const has_stats = Object.keys(item.stats).length > 0 || item?.attack_value !== 0 || item?.attack_multiplier !== 1
    if (two) {
      if (has_stats) line(`${L('base_stats')} `)
      if (item?.attack_value) line(`${L('attack_power')} + ${format_number(item.attack_value)}`)
      if (item?.defense_value) line(`${L('defense_power')} + ${format_number(item.defense_value)}`)
    } else {
      if (has_stats) line(`${L('expected_stats')} `)
      if (item?.attack_value) line(`${L('attack_power')} + ${format_number(item.attack_value * ScaledQualityMultiplier(quality))}`)
      if (item?.defense_value) line(`${L('defense_power')} + ${format_number(item.defense_value * ScaledQualityMultiplier(quality))}`)
    }
    const rarity_mul = two ? 1 : rarity_multipliers[getItemRarity(quality)]
    if (item?.attack_multiplier && item.attack_multiplier !== 1) line(`Size-specific attack power: x${item.attack_multiplier}`)
    for (const key of Object.keys(item.stats)) {
      const stat = item.stats[key]
      if (stat.flat != null) line(`${t(stat_names[key])}: ${sign(stat.flat)}${format_number(stat.flat * (stat.flat > 0 ? rarity_mul : 1))}`)
      if (stat.multiplier != null) {
        const mul = stat.multiplier >= 1 ? stat.multiplier + (stat.multiplier - 1) * (rarity_mul - 1) : stat.multiplier
        line(`${t(stat_names[key])}: x${mul}`)
      }
    }
  }

  const margin = options.trader ? traders[trade_state.current_trader].getProfitMargin() : 1
  blank()
  // format_money returns HTML (coin spans), so this part renders as markup.
  line({ text: t`价值: ${format_money(round_item_price(item.getValue(quality) * margin) || 0)}`, html: true })
  return out
})
</script>

<template>
  <div class="text-[14px]">
    <div v-for="(parts, i) in lines" :key="i" class="min-h-[1lh]">
      <template v-for="(part, j) in parts" :key="j">
        <span v-if="part.html" :class="part.cls" v-html="part.text"></span>
        <b v-else-if="part.b" :class="part.cls">{{ part.text }}</b>
        <span v-else :class="part.cls">{{ part.text }}</span>
      </template>
    </div>
  </div>
</template>
