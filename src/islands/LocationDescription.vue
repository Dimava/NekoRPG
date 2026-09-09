<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { game_state, inf_combat } from 'game/main'

const description = computed(() => {
  const location = game_state.current_location
  return location ? t(location.getDescription()) : ''
})

const sp = computed(() => inf_combat.S3?.sp ?? 0)
const bosses = [
  { key: 'b1', image: 'image/boss/B3706.png', color: 'lightblue' },
  { key: 'b2', image: 'image/boss/B3707.png', color: 'yellow' },
  { key: 'b3', image: 'image/boss/B3708.png', color: 'orange' },
]
</script>

<template>
  <div class="h-[113px] p-[5px] italic text-[rgb(224,224,224)]">{{ description }}</div>
  <div v-if="inf_combat.S3?.live" class="h-[113px] p-[5px] italic">
    <img :src="'image/item/violet_ingot.png'" />
    <b><span class="text-[plum]">{{ t`灵魂之力 : ${sp}` }}</span><br />{{ t('剩余敌人: ') }}</b>
    <template v-for="boss in bosses" :key="boss.key">
      <img :src="boss.image" /><b><span :style="{ color: boss.color }"> x{{ inf_combat.S3[boss.key] }} </span></b>
    </template>
  </div>
</template>
