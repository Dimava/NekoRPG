<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { game_state, faved_stances, change_stance } from 'game/main'
import { stances } from 'game/stances'
import Bar from '../components/Bar.vue'

const selected_name = computed(() => t(stances[game_state.selected_stance]?.name ?? ''))

// Quick-select popup lists the faved stances sorted by name, like the old painter did.
const quick_stances = computed(() =>
  Object.keys(faved_stances)
    .filter(id => stances[id])
    .sort((a, b) => (stances[a].name > stances[b].name ? 1 : -1)),
)

// attack_progress: 0..1 while charging (purple), negative while overcharged (green, "+xN").
const charging = computed(() => game_state.attack_progress >= 0)
const bar_value = computed(() => {
  const n = game_state.attack_progress
  return charging.value ? Math.min(n * 100, 100) : Math.round(n * -100) % 100
})
const overcharge = computed(() => {
  const n = game_state.attack_progress
  return n < -1 ? `(+x${Math.floor(-n)})` : ''
})
</script>

<template>
  <div class="group relative my-[2px] w-[244px] border border-solid border-[gray] p-[3px] text-center">
    <span>{{ selected_name }}</span>
    <div
      class="absolute left-0 top-full z-10 hidden h-fit w-fit text-left outline outline-2 outline-[gray] group-hover:block hover:block"
      :style="{ backgroundImage: 'var(--background_gradient)' }"
    >
      <div v-for="id in quick_stances" :key="id">
        <input
          type="radio"
          :id="'stances_quick_select_' + id"
          name="stance_quick_selection"
          :checked="id === game_state.selected_stance"
          @click="change_stance(id)"
        />
        <label :for="'stances_quick_select_' + id">{{ t(stances[id].name) }}</label>
      </div>
    </div>
  </div>

  <Bar
    :value="bar_value"
    :max="100"
    :height="20"
    :fill="charging ? 'rgb(156, 0, 156)' : 'rgb(99, 255, 99)'"
    track="transparent"
    outline="transparent"
  />
  <div v-if="overcharge" class="my-[2px] w-[244px] border border-solid border-[gray] p-[3px] text-center">{{ overcharge }}</div>
</template>
