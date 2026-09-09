<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { character } from 'game/character'
import { character_unequip_item } from 'game/main'
import Tooltip from './Tooltip.vue'
import ItemTooltip from './ItemTooltip.vue'

const props = defineProps({ name: { type: String, required: true } })

const slot_names = { head: '头部', torso: '躯干', legs: '腿部', feet: '脚部', weapon: '武器', method: '秘法', realm: '领域', law: '法则', props: '道具', special: '特殊', sickle: '镰刀', pickaxe: '镐子', axe: '斧子' }

const item = computed(() => character.equipment[props.name])
const slot_name = computed(() => t(slot_names[props.name] ?? props.name))
const empty_label = computed(() => t`${slot_name.value} 槽位`)
const empty_tooltip = computed(() => t`你的 ${slot_name.value} 槽位`)

function unequip() {
  if (item.value) character_unequip_item(props.name)
}
</script>

<template>
  <div
    class="box-border h-[28px] w-full border border-solid border-white py-px text-center"
    :class="item ? 'text-[14px]' : 'text-[12px] italic text-[silver]'"
    @click="unequip"
  >
    <span v-if="item" :class="'rarity_' + item.getRarity(item.quality)">{{ item.getDisplayName() }}</span>
    <template v-else>{{ empty_label }}</template>
    <Tooltip :width="200">
      <template #content>
        <ItemTooltip v-if="item" :item="item" />
        <div v-else class="text-[14px] not-italic">{{ empty_tooltip }}</div>
      </template>
    </Tooltip>
  </div>
</template>
