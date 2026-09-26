<script setup vapor>
import { computed, nextTick } from 'vue'
import { t } from 'game/t'
import {
  crafting_panel, recipe_key, component_candidates, create_recipe_tooltip_content, create_item_tooltip_content,
  close_crafting_window, switch_crafting_recipes_page, switch_crafting_recipes_subpage,
} from 'game/display'
import { use_recipe, use_recipe_max, global_flags } from 'game/main'
import { character } from 'game/character'
import { item_templates } from 'game/items'
import { recipes } from 'game/crafting-recipes'

// Same DOM shape as the old imperative window: index.html positions recipe tooltips by walking
// `.recipe_div` children, and style.css leans on the nesting too.

const ACTS = [['items', '第一幕'], ['items2', '第二幕'], ['items3', '第三幕'], ['items4', '第四幕']]
const PAGES = [
  { category: 'crafting', label: '合成', subpages: [...ACTS, ['components', '部件'], ['equipment', '装备']] },
  { category: 'cooking', label: '烹饪', subpages: ACTS },
  { category: 'smelting', label: '熔炼', subpages: ACTS },
  { category: 'forging', label: '锻造', subpages: [['items', '物品/饰品'], ['components', '部件']] },
  { category: 'alchemy', label: '炼金', subpages: ACTS },
]
const COMPONENT_NAMES = {
  'long blade': '剑刃', 'triple blade': '三叉戟头', 'short handle': '剑柄',
  'helmet exterior': '头部外甲', 'chestplate exterior': '胸部外甲', 'leg armor exterior': '腿部外甲', 'shoes exterior': '脚部外甲',
  'helmet interior': '头部内甲', 'chestplate interior': '胸部内甲', 'leg armor interior': '腿部内甲', 'shoes interior': '脚部内甲',
  'wheel core': '轮芯', 'wheel head': '轮锋',
}
// the invisible icon only keeps item recipes level with the foldable ones
const SPACER_ICON = '<i class="material-icons icon" style="visibility:hidden"> keyboard_double_arrow_down </i>'
const DROPDOWN_ICON = '<i class="material-icons icon crafting_dropdown_icon"> keyboard_double_arrow_down </i>'
const SUB_ICON = '<i class="material-icons icon subcrafting_dropdown_icon"> keyboard_double_arrow_down </i>'
const EQUIPMENT_CLASSES = { Armor: 'armor_recipe', Weapon: 'weapon_recipe', Shield: 'shield_recipe' }

const page = computed(() => PAGES.find(p => p.category === crafting_panel.page) ?? PAGES[0])
const subpage = computed(() => crafting_panel.subpage[page.value.category] ?? 'items')

const rows = computed(() => {
  const category = page.value.category
  const subcategory = subpage.value
  return Object.entries(recipes[category]?.[subcategory] ?? {})
    .filter(([id]) => id !== '月轮' || global_flags.is_moonwheel_unlocked)
    .map(([recipe_id, recipe]) => {
      const ref = { category, subcategory, recipe_id }
      let kind, cls = ''
      if (subcategory.includes('items')) kind = 'items'
      else if (subcategory === 'components' || recipe.recipe_type === 'component') {
        kind = 'component'
        if (subcategory !== 'components' && recipe.item_type === 'Armor') cls = 'clothing_recipe'
      } else if (subcategory === 'equipment') {
        kind = 'equipment'
        cls = EQUIPMENT_CLASSES[recipe.item_type] ?? ''
        if (!cls) console.warn(`Recipe "${category}" -> "${subcategory}" -> "${recipe_id}" has wrong type of resulting item ("${recipe.item_type}")`)
      }
      return { key: recipe_key(ref), ref, recipe, kind, cls }
    })
})

const is_expanded = row => crafting_panel.expanded === row.key
const list_key = (row, slot) => `${row.key}/${slot}`
const picked = (row, slot) => crafting_panel.components[row.key]?.[slot] ?? null

function row_el(row) {
  return [...document.querySelectorAll('#crafting_window .recipe_div')].find(el => el.dataset.recipeKey === row.key)
}
function scroll_above_exit(el) {
  const exit = document.getElementById('exit_crafting_button')
  if (el && exit && el.getBoundingClientRect().bottom > exit.getBoundingClientRect().top) {
    el.scrollIntoView({ block: 'end', inline: 'nearest' })
  }
}

async function toggle_recipe(row) {
  const opening = !is_expanded(row)
  crafting_panel.expanded = opening ? row.key : null
  if (row.kind === 'equipment') {
    // unfolding starts with a clean pick, like the old list rebuild did
    crafting_panel.components[row.key] = [null, null]
    delete crafting_panel.lists[list_key(row, 0)]
    delete crafting_panel.lists[list_key(row, 1)]
  }
  if (!opening) return
  await nextTick()
  const el = row_el(row)
  if (row.kind === 'component') el?.querySelector('.folded_material_list')?.lastElementChild?.scrollIntoView()
  if (row.kind === 'equipment') scroll_above_exit(el?.querySelector('.recipe_creation_button'))
}

async function toggle_list(row, slot) {
  crafting_panel.lists[list_key(row, slot)] = !crafting_panel.lists[list_key(row, slot)]
  await nextTick()
  const el = row_el(row)
  if (slot === 0) scroll_above_exit(el?.querySelectorAll('.folded_crafting_selection')[0]?.lastElementChild)
  else scroll_above_exit(el?.querySelector('.recipe_creation_button'))
}

function pick(row, slot, item_key) {
  const next = [picked(row, 0), picked(row, 1)]
  next[slot] = next[slot] === item_key ? null : item_key
  crafting_panel.components[row.key] = next
}

function craft_item(row) {
  if (row.recipe.get_availability()) use_recipe(row.ref)
}

function materials(row) {
  return Object.values(character.inventory).flatMap(entry => {
    const material = row.recipe.materials.find(m => m.material_id === entry.item?.id)
    if (!material) return []
    return [{
      key: entry.item.getInventoryKey(),
      material,
      enough: material.count <= entry.count,
      name: item_templates[material.result_id].getDisplayName(),
    }]
  })
}

function equipment_tooltip(row) {
  const components = [picked(row, 0), picked(row, 1)].map(key => key && character.inventory[key]).filter(Boolean)
  return create_recipe_tooltip_content({ ...row.ref, components })
}
</script>

<template>
  <template v-if="crafting_panel.open">
    <div id="crafting_mainpage_buttons" class="crafting_mainpage_buttons">
      <div
        v-for="p in PAGES" :key="p.category" class="crafting_mainpage_button"
        :class="{ active_selection_button: p.category === page.category }"
        @click="switch_crafting_recipes_page(p.category)"
      >{{ t(p.label) }}</div>
    </div>
    <div class="crafting_category" :data-crafting_category="page.category">
      <div class="crafting_subpage_buttons">
        <div
          v-for="[sub, label] in page.subpages" :key="sub" class="crafting_subpage_button"
          :class="[`crafting_subpage_button_${page.subpages.length}`, { active_selection_button: sub === subpage }]"
          @click="switch_crafting_recipes_subpage(page.category, sub)"
        >{{ t(label) }}</div>
      </div>
      <div class="crafting_category crafting_recipe_list" :data-crafting_category="page.category" :data-crafting_subcategory="subpage">
        <div
          v-for="row in rows" :key="row.key" class="recipe_div" :data-recipe_id="row.ref.recipe_id" :data-recipe-key="row.key"
          :class="[row.cls, { selected_recipe: is_expanded(row), recipe_unavailable: row.kind === 'items' && !row.recipe.get_availability() }]"
        >
          <template v-if="row.kind === 'items'">
            <span class="recipe_name" v-html="SPACER_ICON + t(row.recipe.name)" @click="craft_item(row)"></span>
            <span class="recipe_10_button recipe_10" @click="use_recipe_max(row.ref)">[max]</span>
            <div class="recipe_tooltip" :class="`${row.ref.subcategory}_recipe_tooltip`" v-html="create_recipe_tooltip_content(row.ref)"></div>
          </template>

          <template v-else-if="row.kind === 'component'">
            <span class="recipe_name" v-html="DROPDOWN_ICON + t(row.recipe.name)" @click="toggle_recipe(row)"></span>
            <div class="folded_material_list">
              <template v-if="is_expanded(row)">
                <template v-for="m in materials(row)" :key="m.key">
                  <div
                    class="selectable_material" :class="{ recipe_unavailable: !m.enough }" :data-item_key="m.key"
                    @click="m.enough && use_recipe({ ...row.ref, material_key: m.key })"
                  ><i class="material-icons icon selected_material_icon"> check </i>{{ m.name }}<div
                    class="recipe_tooltip component_recipe_tooltip"
                    v-html="create_recipe_tooltip_content({ ...row.ref, material: m.material })"
                  ></div></div>
                  <span class="bigger_button recipe_10" @click="m.enough && use_recipe_max({ ...row.ref, material_key: m.key })">[max]</span>
                </template>
              </template>
            </div>
          </template>

          <template v-else-if="row.kind === 'equipment'">
            <span class="recipe_name" v-html="DROPDOWN_ICON + t(row.recipe.name)" @click="toggle_recipe(row)"></span>
            <div class="component_selections">
              <div v-for="slot in [0, 1]" :key="slot">
                <span
                  class="crafting_selection" :class="{ selected_component_category: crafting_panel.lists[list_key(row, slot)] }"
                  v-html="SUB_ICON + t`选择一个[${COMPONENT_NAMES[row.recipe.components[slot]]}]`" @click="toggle_list(row, slot)"
                ></span>
                <div class="folded_crafting_selection" :class="{ selected_component_list: crafting_panel.lists[list_key(row, slot)] }">
                  <template v-if="is_expanded(row)">
                    <div
                      v-for="c in component_candidates(row.recipe, slot)" :key="c.item.getInventoryKey()"
                      class="selectable_component" :class="{ selected_component: picked(row, slot) === c.item.getInventoryKey() }"
                      :data-item_key="c.item.getInventoryKey()" @click="pick(row, slot, c.item.getInventoryKey())"
                    ><i class="material-icons icon selected_component_icon"> check </i>{{ t(c.item.name) }}, {{ c.item.quality }}%, x{{ c.count }}<span
                      class="recipe_tooltip" v-html="create_item_tooltip_content({ item: c.item, options: { class_name: 'recipe_tooltip' } })"
                    ></span></div>
                  </template>
                </div>
              </div>
            </div>
            <div class="recipe_creation_button" @click="use_recipe(row.ref)">{{ t('制作') }}<div
              class="recipe_tooltip equipment_recipe_tooltip" v-html="equipment_tooltip(row)"
            ></div></div>
            <div class="recipe_creation_button" @click="use_recipe_max(row.ref)">{{ t('[制作最大]') }}<div
              class="recipe_tooltip equipment_recipe_tooltip" v-html="equipment_tooltip(row)"
            ></div></div>
          </template>
        </div>
      </div>
    </div>
    <div id="exit_crafting_button" @click="close_crafting_window()">Exit</div>
  </template>
</template>
