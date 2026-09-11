# Vue island migration plan

Status board for moving every painted box out of `src/display.js`,
`src/main.js` and the inline script in `index.html` into `src/islands/*.vue`.
Process and rules are in `islands.md`. This file is the order, the per-island
facts, and what is done.

Inventories that back this plan live in `.tmp/inv-*.md` (local only):
`inv-index-html.md`, `inv-display-1.md`, `inv-display-2.md`, `inv-main-dom.md`.

## Ground rules that came out of the inventories

- Game state is reactive already (`islands.md` section 4). Islands read
  `character`, `skills`, `game_state`, `trade_state`, `inf_combat`,
  `family_data`, `options`, `active_effects`, `current_game_time`.
- Per-tick numbers that main.js pushes into bars (attack progress, enemy
  attack bars, activity progress) get a small reactive holder next to the
  code that computes them. The painter becomes one assignment.
- Painters that also mutate state keep the mutation and lose the paint.
  Known cases: `log_message` (message_count), `update_displayed_time`
  (`inf_combat.ST`), `update_displayed_ongoing_activity` (`inf_combat.A7`,
  `unlock_location`, `current_game_time.go_up`), `update_displayed_family`
  (`init_family`), `update_displayed_reactor` (`reactor_init`),
  `create_location_types_display` (log lines), `use_recipe` / `use_recipe_max`
  (read selection from DOM).
- Every `window.foo = foo` that exists only for an `onclick` string dies with
  the island that owned the button. `@click` calls the imported function.
- Chinese that leaves `index.html` goes through `t()` and gets a glossary
  entry before `bun run compile`.
- Commit per island. Each island is one reviewable change: vue file, host
  attribute, painter gutted, CSS deleted, glossary, build.

## Shared components (build before the islands that need them)

| Component | Replaces | Needed by |
| --- | --- | --- |
| `ItemTooltip.vue` | `create_item_tooltip_content` (display.js 281-493, HTML string) | Equipment, Inventory, Trade, Crafting |
| `Bar.vue` | the `*_bar_current` div pairs | BasicInfo, Combat, CombatManagement, activities, minigames |
| `Tooltip.vue` | exists | everything |

`ItemTooltip` renders structured data, not the HTML string. The old function
stays for a while because crafting tooltips still call it; delete it when
Crafting lands.

## Order

Smallest and most isolated first. Each row is one commit.

### Batch 1: leaf panels driven by `character`

| # | Island | Host | Old paint | State | Handlers | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | BasicInfo | `#basic_character_info_div` | `update_displayed_health`, `update_displayed_character_xp`, rank part of `update_displayed_stats`, name field at main.js 290 | `character`, `active_effects`, `REALMS` | name `change` writes `character.name` | first one, sets the Bar component |
| 2 | DataBox | `#data_box_div` | `update_displayed_xp_bonuses` | `get_hero_xp_gain`, `get_skills_overall_xp_gain`, kill and craft counters | `get_money(n)` bank buttons | counters are lets in main.js: mirror `total_*` on `game_state` |
| 3 | Options | `#options_panel` | seven `option_*` functions in main.js 306-471 | `options`, `message_log_filters` | checkboxes become `v-model`; keep side effects (`set_number_units`, bgm mute, textsize CSS var) | load restores from `options`, not from checkbox state |
| 4 | CombatManagement | `#character_combat_management` | `update_displayed_stance`, `update_displayed_faved_stances`, `update_character_attack_bar` | `game_state.selected_stance`, `faved_stances`, attack holder | stance select calls `change_stance` | attack bar holder in main.js next to line 1849 |
| 5 | LocationDescription | `#location_div` | description writes in `update_displayed_normal_location` 1670 and `update_displayed_combat_location` 1987, S3 HUD | `game_state.current_location`, `inf_combat.S3` | none | |
| 6 | Equipment + Tools | `#character_equipment_div`, `#character_tools_div` | `update_displayed_equipment` | `character.equipment` | click calls `unequip_item` | first user of ItemTooltip; kills the equipment mousemove handlers in prepareGame |

### Batch 2: lists

| # | Island | Host | Old paint | State | Handlers | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 7 | MessageLog | `#message_log_div` | `log_message`, `clear_message_log`, filter buttons | new `messages` reactive array in display.js, `message_log_filters` | filter toggles write `message_log_filters` | `log_message` keeps `message_count`; cap array length; drop the `--message_*_display` CSS vars and `option_remember_filters` DOM sync |
| 8 | Combat | `#combat_div` | `update_displayed_enemies`, `update_displayed_health_of_enemies`, `update_enemy_attack_bar`, `enemy_count_div` writes, `E{n}_effect` classes | `game_state.current_enemies`, enemy attack holder | none | enemy HP tracks through the proxy; effect flashes become a per-enemy `flash` field the island watches |
| 9 | Stances | `#stance_list_div` | `update_displayed_stance_list`, `update_stance_tooltip`, stance tooltips | `stances`, `skills`, `faved_stances` | `fav_stance`, `change_stance` | radios generated today; move `select_stance` out of index.html |
| 10 | Skills | `#skill_list_div` | `create_new_skill_bar`, `update_displayed_skill_bar`, `*_skill_description`, `*_skill_xp_gain`, `sort_displayed_skills`, category fold | `skills`, `skill_sorting` holder | sort buttons | 61 skills, categories, milestone tooltips; drop `skill_bar_divs` cache |
| 11 | Family | `#family_div` | `update_displayed_family`, `update_displayed_family_members`, baby input, attitude selects | `family_data`, `global_flags` | baby `v-model`, attitude select writes `family_data.mem[r].ali` | keep `init_family` calls in main.js |
| 12 | Quests | `#quests_box_div` | `update_quests` in main.js | `inf_combat.VP/MP/InP`, `global_flags` | `gem_consume`, `coin_consume`, `influ_consume` | |
| 13 | Bestiary | `#bestiary_box_div` | `create_new_bestiary_entry`, `add_bestiary_lines`, `add_bestiary_zones`, `add_bestiary_tooltip`, `update_bestiary_entry` | `enemy_templates`, `enemy_killcount`, `spec_stat` | `change_location` on zone rows | `enemy_killcount` must become reactive |
| 14 | Levelary | `#levelary_box_div` | `create_new_levelary_entry`, `add_levelary_tooltip` | `locations`, `inf_combat`, `character` | none | same shape as Bestiary |
| 15 | Tab bars and bottom bar | `#skill_and_stance_control_div`, `#journal_control_div`, `#character_control_div`, `#inventory_combat_switch_selection`, `#bottom_panel_div` | CSS-var toggles in the inline script, `update_displayed_time` save button, `update_backup_load_button` | a `ui_state` reactive for active tabs | local `show*` functions | do after the tab contents are islands so the hosts can `v-show` |

### Batch 3: tangled

| # | Island | Host | Old paint | State | Handlers | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | Inventory | `#inventory_div` | `update_displayed_character_inventory`, `create_inventory_item_div`, `sort_displayed_inventory`, `update_displayed_book`, `update_displayed_money` | `character.inventory`, `to_buy`, `to_sell`, `trade_state`, sort holder | use, use max, equip, read, trade amount buttons | drop `item_divs` cache; `inventory_div.onclick` delegation in prepareGame goes |
| 17 | Trade | `#trade_div` | `update_displayed_trader`, `update_displayed_trader_inventory`, `create_trade_buttons`, `exit_displayed_trade` | `trade_state`, `traders`, `to_buy`, `to_sell` | buy, sell, accept, cancel, exit | move `in_trade`, `total_price`, `number_to_move` out of the inline script into trade.js |
| 18 | LocationActions | `#location_actions_div` | `update_displayed_normal_location`, `create_location_choices`, `update_displayed_location_choices`, `update_displayed_dialogue`, `update_displayed_textline_answer`, `start_activity_display`, `update_displayed_ongoing_activity`, `start_sleeping_display`, `start_reading_display`, `start_activity_animation`, gathering tooltips | `game_state` (location, dialogue, activity, sleeping, reading), `activities`, `dialogues`, `traders`, activity holder | travel, talk, textline, job, gather, sleep, read, open crafting | one island with a mode switch; the 600 ms text animation becomes a ticking ref |
| 19 | Crafting | `#crafting_window` | everything from `open_crafting_window` to `update_item_recipe_tooltips` (display.js 2019-2636) | `recipes`, `global_flags`, a `crafting_state` holder with page, subpage, selected recipe, component, material | tabs, recipe rows, component and material pickers, craft, craft max | `use_recipe` and `use_recipe_max` read the selection from `crafting_state` instead of the DOM; `unlock_moonwheel` becomes a flag read |

### Batch 4: minigames

Physics loops stay in main.js. Each loop writes a reactive holder; the island
paints from it. Buttons call the exported functions.

| # | Island | Host | main.js range | Holder |
| --- | --- | --- | --- | --- |
| 20 | Fishing | `#fish_div` and `#fish_changed_div` | 4980-5206 | `fishing_state` |
| 21 | Grass | `#grass_div` | 5244-5354 | `grass_state`; island owns the canvas and calls `redraw_grass(ctx)` |
| 22 | Digging | `#digging_div` | 5356-5494 | `digging_state` |
| 23 | Reactor | `#reactor_div` | 5499-5721 | reads `inf_combat.RT` directly |
| 24 | Engine | `#engine_div` | 5724-6059 | reads `inf_combat.FE` directly |

### Last

- `prepareGame` in index.html: by then it should only hold the tooltip
  movers for panels that no longer exist. Delete it.
- `window.*` exports in main.js 6758-6836: delete what nothing calls.
- `display.js` exports: delete the dead painters and the DOM handle consts.
- Global FX overlays (`#screen_effect`, `#sky_effect`, `#cloudy_effect`) and
  the loading screen stay as they are. They are class toggles, not paint.

## Done

| Island | Commit |
| --- | --- |
| TimeAndLocation | 2cee4cf |
| CharacterStats | 1bf10b1 |
| BasicInfo | leaf-panel checkpoint |
| DataBox | leaf-panel checkpoint |
| Options | leaf-panel checkpoint |
| CombatManagement | leaf-panel checkpoint |
| LocationDescription | leaf-panel checkpoint |
| Equipment + Tools (ItemTooltip, EquipmentSlot) | leaf-panel checkpoint |
| Tab bars + BottomBar + Options overlay | 7bc01a4 |
| MessageLog | 9b6f31c |
| Combat | 85178ad |
| Stances | 1b3552f |
| Skills | this commit |
