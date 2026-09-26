<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { format_number } from 'game/display'
import { skills } from 'game/skills'
import { activities } from 'game/activities'

// What a gathering activity finds and how fast, for the location row and the running activity.
const props = defineProps({ activity: { type: Object, required: true } })

const info = computed(() => {
  const activity = props.activity
  const { gathering_time_needed, gained_resources } = activity.getActivityEfficiency()
  const scaling = activity.gained_resources.scales_with_skill && {
    skills: activities[activity.activity_name].base_skills_names.map(skill => skills[skill].name()).join(''),
    from: activity.gained_resources.skill_required[0],
    to: activity.gained_resources.skill_required[1],
  }
  const resources = gained_resources.map(resource => ({
    name: resource.name,
    chance: resource.chance > 0.01 ? Math.round(100 * resource.chance) : '???',
    count: resource.count[0] === resource.count[1] ? resource.count[0] : `${resource.count[0]}-${resource.count[1]}`,
  }))
  const decay = activity.exp_scaling && activity.done_actions != 0 && {
    actions: activity.done_actions,
    time: format_number(Math.pow(activity.exp_o, activity.done_actions)),
  }
  return { scaling, seconds: Math.round(gathering_time_needed), resources, decay }
})
</script>

<template>
  <template v-if="info.scaling">
    <span class="activity_efficiency_info">{{ t('效率折算:') }}<br>{{ t`"${info.scaling.skills}" 技能等级 ${info.scaling.from} 到 ${info.scaling.to}` }}</span><br><br>
  </template>
  {{ t`每 ${info.seconds} 秒, 发现的机会:` }}
  <template v-for="r in info.resources" :key="r.name"><br>x{{ r.count }} "{{ t(r.name) }}" ({{ r.chance }}%)</template>
  <template v-if="info.decay">
    <br><br><b><span style="color:red">{{ t('收益递减:') }}</span></b><br>{{ t`因为已经进行的 ${info.decay.actions} 次行动,` }}<br> {{ t`消耗的时间 x ${info.decay.time}` }}
  </template>
</template>
