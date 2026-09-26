<script setup vapor>
import { computed } from 'vue'
import { t } from 'game/t'
import { game_state } from 'game/main'
import { character } from 'game/character'
import { item_templates, Weapon, Armor, Shield } from 'game/items'
import { recipes } from 'game/crafting-recipes'
import ItemTooltip from './ItemTooltip.vue'

// Recipe tooltip body: level and success chance for item recipes, the materials
// with how many you have, and the result as an item tooltip.
// components: the two picked inventory entries of an equipment recipe.
const props = defineProps({
  category: String,
  subcategory: String,
  recipe_id: String,
  material: Object,
  components: Array,
})

const EQUIPMENT = { Weapon: [Weapon, 'head', 'handle'], Armor: [Armor, 'internal', 'external'], Shield: [Shield, 'shield_base', 'handle'] }

const have = material => {
  const key = item_templates[material.material_id].getInventoryKey()
  return character.inventory[key]?.count || 0
}
const material_row = material => ({
  key: material.material_id,
  name: item_templates[material.material_id].getDisplayName(),
  have: have(material),
  need: material.count,
})

const view = computed(() => {
  const { category, subcategory, recipe_id, material, components } = props
  const recipe = recipes[category][subcategory][recipe_id]
  const station_tier = game_state.current_location?.crafting?.tiers[category] || 0

  if (subcategory.includes('items')) {
    const success = Math.round(100 * recipe.get_success_chance(station_tier))
    return {
      level: recipe.recipe_level[1],
      success,
      success_color: success > 74 ? 'lime' : success > 49 ? 'yellow' : success > 24 ? 'orange' : 'red',
      materials: recipe.materials.map(material_row),
      result: {
        item: item_templates[recipe.getResult().result_id],
        options: recipe.Q_able > 0 ? { quality: recipe.Q_able, skip_quality: false } : { skip_quality: true },
      },
    }
  }
  if (subcategory === 'components' || recipe.recipe_type === 'component' || (subcategory === 'equipment' && !components)) {
    // componentless equipment (clothing) reads like a component recipe
    const result = item_templates[material.result_id]
    return {
      materials: [material_row(material)],
      result: { item: result, options: { quality: recipe.get_quality_range(station_tier - result.component_tier) } },
    }
  }
  if (subcategory === 'equipment') {
    if (components.length < 2) return { hint: '请在每一类中选择一个部件' }
    const [Kind, first, second] = EQUIPMENT[recipe.item_type] ?? []
    if (!Kind) throw new Error(`Recipe "${category}" -> "${subcategory}" -> "${recipe_id}" has an incorrect item type "${recipe.item_type}"`)
    const [a, b] = components.map(c => c.item)
    const item = new Kind({ components: { [first]: a.id, [second]: b.id } })
    const quality = recipe.get_quality_range(recipe.get_component_quality_weighted(a, b), (station_tier - Math.max(a.component_tier, b.component_tier)) || 0)
    return { result: { item, options: { quality } } }
  }
  console.error(`No such crafting subcategory as "${subcategory}"`)
  return {}
})
</script>

<template>
  <template v-if="view.level != null">
    {{ t`配方等级：${view.level}` }}<br>
    {{ t('成功率:') }} <b><span :style="{ color: view.success_color }">{{ view.success }}%</span></b><br><br>
  </template>
  <template v-if="view.materials">
    {{ t('材料:') }}<br>
    <template v-for="m in view.materials" :key="m.key">
      <span :style="{ color: m.have >= m.need ? 'lime' : 'red' }"><b>{{ m.name }} x{{ m.have }}/{{ m.need }}</b></span><br>
    </template>
    <br>
  </template>
  <template v-if="view.hint">{{ t('产物:') }}<br><div class="recipe_result">{{ t(view.hint) }}</div></template>
  <template v-else-if="view.result">{{ t('产物:') }}<br><div class="recipe_result"><ItemTooltip :item="view.result.item" :options="view.result.options" /></div></template>
</template>
