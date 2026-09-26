<script setup vapor>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { t } from 'game/t'
import {
  action_panel, format_money, format_number,
  update_displayed_location_choices, update_displayed_normal_location, open_crafting_window,
} from 'game/display'
import { format_time } from 'game/game-time'
import { format_reading_time } from 'game/misc'
import {
  game_state, global_flags, inf_combat, can_work, enough_time_for_earnings, change_location,
  start_dialogue, end_dialogue, start_textline, start_activity, end_activity,
  start_sleeping, end_sleeping, end_reading,
} from 'game/main'
import { character, get_skills_overall_xp_gain } from 'game/character'
import { skills } from 'game/skills'
import { item_templates } from 'game/items'
import { locations } from 'game/locations'
import { traders } from 'game/traders'
import { start_trade } from 'game/trade'
import { dialogues } from 'game/dialogues'
import { activities } from 'game/activities'

// Rows are {key, id?, cls, html, click}. `html` keeps the exact t`...` skeletons the old
// imperative code used, so the catalog keeps hitting.

const FOLD_ICON = '<i class="material-icons">format_list_bulleted</i>  '
const ACTIVITY_NAMES = { Running: '跑步', Swimming: '游泳', mining: '挖掘', woodcutting: '砍伐', fishing: '钓鱼', AquaElement: '水元素感应' }

const has_open_lines = key => {
  const dialogue = dialogues[key]
  return dialogue.is_unlocked && !dialogue.is_finished
    && Object.values(dialogue.textlines).some(line => line.is_unlocked && !line.is_finished)
}
const skills_ready = activity => activities[activity.activity_name].base_skills_names.every(skill => skills[skill].is_unlocked)
const is_open = (activity, type) => activities[activity.activity_name]?.is_unlocked && activity?.is_unlocked
  && activities[activity.activity_name].type === type
const available = (location, type) => Object.values(location.activities).filter(a => is_open(a, type) && skills_ready(a))
const open_challenges = location => location.connected_locations
  .filter(c => c.location.is_challenge && c.location.is_unlocked && !c.location.is_finished)

function gathering_tooltip_html(activity) {
  const { gathering_time_needed, gained_resources } = activity.getActivityEfficiency()
  const skill_names = activities[activity.activity_name].base_skills_names.map(skill => skills[skill].name()).join('')
  let html = ''
  if (activity.gained_resources.scales_with_skill) {
    const [from, to] = activity.gained_resources.skill_required
    html = t`<span class="activity_efficiency_info">效率折算:<br>"${skill_names}" 技能等级 ${from} 到 ${to}</span><br><br>`
  }
  html += t`每 ${Math.round(gathering_time_needed)} 秒, 发现的机会:`
  for (const resource of gained_resources) {
    const chance = resource.chance > 0.01 ? Math.round(100 * resource.chance) : '???'
    const count = resource.count[0] === resource.count[1] ? resource.count[0] : `${resource.count[0]}-${resource.count[1]}`
    html += t`<br>x${count} "${resource.name}" (${chance}%)`
  }
  if (activity.exp_scaling && activity.done_actions != 0) {
    const exp_t = activity.done_actions
    html += t`<br><br><b><span style="color:red">收益递减:</span></b><br>因为已经进行的 ${exp_t} 次行动,<br> 消耗的时间 x ${format_number(Math.pow(activity.exp_o, exp_t))}`
  }
  return html
}

function job_tooltip_html(activity) {
  let html = ''
  if (!activity.infinite) {
    html = t`Available from ${activity.availability_time.start} to ${activity.availability_time.end} <br>`
  }
  return html + `Pays ${format_money(activity.get_payment())} per every `
    + `${format_time({ time: { minutes: activity.working_period } })} worked`
}

const travel = (key, cls, html, name) => ({ key, cls: [...cls, 'action_travel'], html, click: () => change_location(name) })

function travel_choices(location, is_combat) {
  const rows = []
  if (!is_combat) {
    for (const c of location.connected_locations) {
      if (c.location.is_unlocked == false || c.location.is_finished || c.location.is_challenge) continue
      const name = c.location.name
      if ('connected_locations' in c.location) {
        const html = 'custom_text' in c
          ? t`<i class="material-icons">directions</i> ${c.custom_text}`
          : t`<i class="material-icons">directions</i>  前往 [${name}]`
        rows.push(travel(`to-${name}`, ['travel_normal'], html, name))
      } else {
        const html = 'custom_text' in c
          ? t`<span style="color:#ffc0c0"><i class="material-icons">warning_amber</i> ${c.custom_text}</span>`
          : t`<span style="color:#ffc0c0"><i class="material-icons">warning_amber</i>  进入 [${name}]</span>`
        rows.push(travel(`to-${name}`, ['travel_combat'], html, name))
      }
    }
    const last_combat = game_state.last_combat_location
    if (last_combat && !location.connected_locations.some(c => c.location.name === last_combat)) {
      const name = locations[last_combat].name
      rows.push(travel('last-combat', ['travel_combat', 'travel_fast_return'],
        t`<span style="color:#ffd8c0"><i class="material-icons">warning_amber</i>  快速返回 [${name}]</span>`, name))
    }
  } else {
    const name = location.parent_location.name
    const html = location.leave_text
      ? t`<i class="material-icons">directions</i>  ${location.leave_text}`
      : t`<i class="material-icons">directions</i>  回到 ${name}`
    rows.push(travel('leave', ['travel_normal'], html, name))
  }

  const last_bed = game_state.last_location_with_bed
  if (!inf_combat.S3?.live && last_bed && !location.sleeping
      && !location.connected_locations?.some(c => c.location.name === last_bed)) {
    const name = locations[last_bed].name
    rows.push(travel('last-bed', ['travel_normal', 'travel_fast_return'],
      t`<span style="color:#c0c0ff"><i class="material-icons">directions</i> 快速返回 [${name}]</span>`, name))
  }

  return rows.sort((a, b) => b.cls.includes('travel_normal') - a.cls.includes('travel_normal'))
}

function choices(location, category, add_icons = true, is_combat = false) {
  const activity_rows = type => Object.keys(location.activities).filter(key => is_open(location.activities[key], type))
  switch (category) {
    case 'talk':
      return location.dialogues.filter(has_open_lines).map(key => {
        const dialogue = dialogues[key]
        const npcName = dialogue.name
        const text = dialogue.starting_text === `与 ${npcName} 对话` ? t`与 ${npcName} 对话` : t(dialogue.starting_text)
        const icon = add_icons ? '<i class="material-icons">question_answer</i>  ' : ''
        return { key: `talk-${key}`, cls: ['start_dialogue'], html: icon + text, click: () => start_dialogue(key) }
      })
    case 'trade':
      return location.traders.filter(key => traders[key].is_unlocked).map(key => {
        const trader = traders[key]
        const traderName = trader.name
        const html = trader.trade_text.includes('storefront')
          ? t`<span style="color:#ffffd0"> <i class="material-icons">storefront</i> 与 ${traderName} 交易</span>`
          : t(trader.trade_text)
        return { key: `trade-${key}`, cls: ['start_trade'], html, click: () => start_trade(key) }
      })
    case 'work':
      return activity_rows('JOB').map(key => {
        const activity = location.activities[key]
        return {
          key: `work-${key}`,
          cls: ['activity_div', can_work(activity) ? 'start_activity' : 'activity_unavailable'],
          html: t`<i class="material-icons">work_outline</i>  `
            + `<div class="job_tooltip">${job_tooltip_html(activity)}</div>`
            + t(activity.starting_text),
          click: () => start_activity(key),
        }
      })
    case 'train':
      return activity_rows('TRAINING').filter(key => skills_ready(location.activities[key])).map(key => ({
        key: `train-${key}`,
        cls: ['activity_div', 'start_activity'],
        html: t`<span style="color:#d8c0ff"><i class="material-icons">fitness_center</i> </span> `
          + `<span style="color:#d8c0ff">` + t(location.activities[key].starting_text) + '</span>',
        click: () => start_activity(key),
      }))
    case 'gather':
      return activity_rows('GATHERING').filter(key => skills_ready(location.activities[key])).map(key => ({
        key: `gather-${key}`,
        cls: ['activity_div', 'start_activity'],
        // the skeleton leaves its span open; the old innerHTML += closed it right here
        html: t`<span style="color:#ffc0d0"><i class="material-icons">search</i>  ` + '</span>'
          + `<div id="gathering_tooltip" class="job_tooltip">${gathering_tooltip_html(location.activities[key])}</div>`
          + `<span style="color:#ffc0e0">` + t(location.activities[key].starting_text) + '</span>',
        click: () => start_activity(key),
      }))
    case 'travel':
      return travel_choices(location, is_combat)
    case 'challenge':
      return open_challenges(location).map(c => {
        const html = 'custom_text' in c
          ? t`<span style="color:#ff8080"><i class="material-icons icon">warning_amber</i>  ${c.custom_text}</span>`
          : t`<span style="color:#ff8080"><i class="material-icons">warning_amber</i>  进入 ${c.location.name}</span>`
        return travel(`challenge-${c.location.name}`, ['travel_combat'], html, c.location.name)
      })
  }
  return []
}

function location_rows(location) {
  const rows = []
  const fold = (category, label) => ({
    key: `fold-${category}`, cls: ['location_choices'], html: FOLD_ICON + label,
    click: () => update_displayed_location_choices({ category }),
  })
  // more than two of a kind fold into one button
  const folded = (category, count, label) => count > 2 ? rows.push(fold(category, label)) : rows.push(...choices(location, category))

  const dialogue_count = location.dialogues.filter(has_open_lines).length
  folded('talk', dialogue_count, 'Talk to someone')
  const trader_count = location.traders.filter(key => traders[key].is_unlocked).length
  folded('trade', trader_count, 'Visit a merchant')
  const job_count = available(location, 'JOB').length
  folded('work', job_count, 'Find some work')
  const training_count = available(location, 'TRAINING').length
  folded('train', training_count, 'Train for a bit')
  const gathering_count = global_flags.is_gathering_unlocked ? available(location, 'GATHERING').length : 0
  if (global_flags.is_gathering_unlocked) folded('gather', gathering_count, 'Gather some resources')

  if (location.sleeping) {
    rows.push({
      key: 'sleep', id: 'start_sleeping_div', cls: [],
      html: t`<span style = "color:#cce0ff"><i class="material-icons">bed</i>  ${location.sleeping.text}</span>`,
      click: () => start_sleeping(),
    })
  }

  // challenges never fold, having many is not expected
  rows.push(...choices(location, 'challenge'))

  const can_craft = global_flags.is_crafting_unlocked && location.crafting?.is_unlocked
  if (can_craft) {
    rows.push({
      key: 'craft', cls: ['location_choices'],
      html: t`<span style="color:#c0ffc0"><i class="material-icons">construction</i> ${location.crafting.use_text}</span>`,
      click: () => open_crafting_window(),
    })
  }

  const travel_count = location.connected_locations
    .filter(c => c.location.is_unlocked && !c.location.is_finished && !c.location.is_challenge).length
  const other_action_count = (location.sleeping ? 1 : 0) + training_count + job_count + trader_count
    + dialogue_count + gathering_count + open_challenges(location).length + (can_craft ? 1 : 0)
  if (travel_count > 3 && other_action_count > 2) rows.push(fold('travel', t('展开')))
  else if (travel_count > 0) rows.push(...choices(location, 'travel'))

  return rows
}

function dialogue_rows(dialogue_key) {
  const dialogue = dialogues[dialogue_key]
  const flags_ok = ({ yes = [], no = [] } = {}) => [].concat(yes).every(flag => global_flags[flag])
    && ![].concat(no).some(flag => global_flags[flag])
  const rows = Object.entries(dialogue.textlines)
    .filter(([, line]) => line.is_unlocked && !line.is_finished && flags_ok(line.required_flags ?? {}))
    .map(([key, line]) => ({
      key: `line-${key}`, cls: ['dialogue_textline'], html: t`"${t(line.name)}"`, click: () => start_textline(key),
    }))
  if (dialogue.trader) {
    rows.push({
      key: 'trade', cls: ['dialogue_trade'], html: t(traders[dialogue.trader].trade_text),
      click: () => start_trade(dialogue.trader),
    })
  }
  rows.push({
    key: 'end', cls: ['end_dialogue_button'],
    html: t`<i class='material-icons'>arrow_back</i> ${dialogue.ending_text}`, click: () => end_dialogue(),
  })
  return rows
}

// what the panel shows follows the game: an open dialogue wins, then activity, sleep and reading
const mode = computed(() => {
  if (game_state.current_dialogue) return 'dialogue'
  if (game_state.current_activity) return 'activity'
  if (game_state.is_sleeping) return 'sleeping'
  if (game_state.is_reading) return 'reading'
  const location = game_state.current_location
  if (!location) return null
  if (!('connected_locations' in location)) return 'combat'
  return action_panel.expanded ? 'choices' : 'location'
})

const rows = computed(() => {
  const location = game_state.current_location
  switch (mode.value) {
    case 'dialogue': return dialogue_rows(game_state.current_dialogue)
    case 'location': return location_rows(location)
    case 'combat': return choices(location, 'travel', true, true)
    case 'choices': {
      const { category, add_icons, is_combat } = action_panel.expanded
      return [...choices(location, category, add_icons, is_combat), {
        key: 'return', cls: ['choices_return_button'], html: "<i class='material-icons'>arrow_back</i> " + t('收起'),
        click: () => update_displayed_normal_location(),
      }]
    }
  }
  return []
})

// busy views: the old "animation" cycled up to three dots after the status text
const busy = computed(() => ['activity', 'sleeping', 'reading'].includes(mode.value))
const dots = ref(0)
let timer
onMounted(() => { timer = setInterval(() => { if (busy.value) dots.value = (dots.value + 1) % 4 }, 600) })
onUnmounted(() => clearInterval(timer))
const animated = text => text.replace(/\.{1,3}$/, '') + '.'.repeat(dots.value)

const activity = computed(() => mode.value === 'activity' ? game_state.current_activity : null)
const activity_def = computed(() => activity.value && activities[activity.value.activity_name])
const is_job = computed(() => activity_def.value?.type === 'JOB')

const xp_text = computed(() => {
  const current = activity.value
  const skill = skills[activity_def.value?.base_skills_names?.[0]]
  if (!skill) return ''
  const needed_xp = skill.current_level == skill.max_level ? 'Max' : `${Math.round(10000 * skill.current_xp / skill.xp_to_next_lvl) / 100}%`
  return activity_def.value.type !== 'GATHERING'
    ? t`每秒获取 ${format_number(current.skill_xp_per_tick * get_skills_overall_xp_gain())}  ${skill.name()} 经验值 (${needed_xp})`
    : t`得到 ${current.skill_xp_per_tick} 基本经验 每个采集循环 对于 ${skill.name()} (${needed_xp})`
})

// goto2-5: the trip itself advances in main.js; this only reports it
const trip_html = computed(() => {
  if (activity.value?.spec !== 'goto2-5') return ''
  const cur = inf_combat.A7?.cur ?? 0
  if (cur >= 3.2e6) return t('<br>目的地 已抵达.(从[纳家秘境]出发)')
  const running = skills['Running'].current_level
  const base_speed = Math.pow(character.stats.full.agility, 0.5) / 10
  const speed = base_speed * Math.pow(1.1, running)
  return t('<br>前往声律城...')
    + t`<br>基础速度: ${format_number(base_speed)} m / s.`
    + t`<br>速度: ${format_number(speed)} m / s. <br>(跑步 lv.${running}, + ${format_number(Math.pow(1.1, running) * 100 - 100)}%)`
    + t`<br>时间流速: 36000 s / s.`
    + t`<br>最终速度: ${format_number(speed * 36)} km / s.`
    + t`<br>剩余距离：${Math.round(3.2e6 - cur).toLocaleString('en-US')} / 3,200,000 km.`
})

const earnings_time_html = computed(() => {
  const current = activity.value
  return enough_time_for_earnings(current)
    ? t`Next earnings in: ${format_time({ time: { minutes: current.working_period - current.working_time % current.working_period } })}`
    : t`There's not enough time left to earn more, but ${character.name} might still learn something...`
})

const status = computed(() => {
  if (mode.value === 'sleeping') return animated(t('睡觉...'))
  if (mode.value === 'reading') {
    return animated(`Reading the book, ${format_reading_time(item_templates[game_state.is_reading].getRemainingTime())} left`)
  }
  return activity_def.value ? animated(t(activity_def.value.action_text)) : ''
})

const end_text = computed(() => {
  if (mode.value === 'sleeping') return t('起床')
  if (mode.value === 'reading') return 'Stop reading for now'
  return t`结束 ${ACTIVITY_NAMES[activity.value?.activity_name]}`
})

function end_busy() {
  if (mode.value === 'sleeping') end_sleeping()
  else if (mode.value === 'reading') end_reading()
  else end_activity()
}
</script>

<template>
  <template v-if="busy">
    <div id="action_status_div">{{ status }}</div>
    <template v-if="activity">
      <div id="action_xp_div">{{ xp_text }}<span v-if="trip_html" v-html="trip_html"></span></div>
      <div v-if="is_job" id="time_for_earnings_div" v-html="earnings_time_html"></div>
      <div v-if="activity.gained_resources" id="gathering_progress_bar_max">
        <div id="gathering_progress_bar" :style="{ width: 385 * activity.gathering_time / activity.gathering_time_needed + 'px' }"></div>
        <div id="gathering_tooltip" class="job_tooltip" v-html="gathering_tooltip_html(activity)"></div>
      </div>
    </template>
    <div id="action_end_div" @click="end_busy()">
      <div id="action_end_text">{{ end_text }}</div>
      <div v-if="is_job" id="action_end_earnings" v-html="t`(earnings: ${format_money(activity.earnings)})`"></div>
    </div>
  </template>
  <template v-else>
    <div
      v-if="mode === 'dialogue'" id="dialogue_answer_div"
      :style="action_panel.answer ? { padding: '10px' } : null" v-html="action_panel.answer"
    ></div>
    <div v-for="row in rows" :key="row.key" :id="row.id" :class="row.cls" v-html="row.html" @click="row.click()"></div>
  </template>
</template>
