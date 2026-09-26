# FIXME: style debt in the Vue port

Notes on where the current port style is weaker than it could be. These are not bugs. Each one is a pattern that will grow if copied into more panels.

## 1. Tombstones and empty stubs (done, keep it that way)

`display.js` used to hold `function update_displayed_money() {}`, `update_displayed_enemies() {}`, `add_bestiary_tooltip() {}` and 18 more, plus `/** replaced by the X island ... */` blocks quoting the deleted code, and main.js kept calling them. Those are gone. `update_displayed_character_inventory` is the one remaining no-op, because islands and index.html still call it.

For future ports: delete the stub, its import and every call site in the same commit that ports the panel. Git history already records what was there. A stub that nothing needs is a trap for the next reader, who has to check whether it does anything. `.scratch/drop-stubs.ts` does this mechanically.

## 2. `pulse++` counters

`location_panel.pulse`, `stance_panel.pulse`, `trade_state.pulse`, `inventory_panel.book_pulse` and now `action_panel.pulse` exist because `dialogues`, `traders`, `activities`, `locations` and `item_templates` are plain objects. Every mutation site has to remember to bump the matching pulse, and forgetting one gives a stale panel.

Better: wrap the content tables in `reactive()` where they are defined, the way `skills`, `character` and `enemy_killcount` already are. Then islands track `is_unlocked` / `is_finished` directly and the pulses can go. Check first that nothing does identity comparison against the raw objects. `toRaw` fixes those spots.

## 3. View mode as "last setter wins"

`action_panel.mode` is set by whichever `start_*_display` ran last. That matches the old DOM behavior exactly, so I kept it for a blind port. But the view can disagree with the game. For example, `start_sleeping()` does not end reading. After waking up, `end_sleeping()` repaints the location list, yet `is_reading` is still set, so the book keeps progressing with no "stop reading" button on screen.

Better: derive the mode from `game_state` (`current_dialogue`, `current_activity`, `is_sleeping`, `is_reading`) plus one UI-only field for the expanded category. After that, main.js doesn't have to call any display function for this panel.

## 4. The `game_state.x = v; x = game_state.x` mirror

main.js keeps every piece of live state twice: once as a module `let` and once in `game_state`, with a two-line write at each assignment. Missing either half desyncs islands from game logic.

Better: read and write `game_state.x` directly and drop the `let`s, one variable per commit. Exported `let`s such as `last_combat_location` then become `game_state.last_combat_location`, which the new island already uses.

## 5. Game logic inside display functions

The goto2-5 trip (distance, time skip, location unlock) lived in `update_displayed_ongoing_activity`. It is now `travel_to_shenglv()` in main.js. Expect the same thing in the minigames and crafting code: anything that mutates `character`, `inf_combat`, time or inventory belongs in main.js before the view is ported.

## 6. Markup inside translation keys

Keys like `` t`<span style="color:#ffc0c0"><i class="material-icons">warning_amber</i>  进入 [${name}]</span>` `` tie the catalog to inline styles. You can't restyle a button without breaking its translation, and the icon markup is duplicated in every entry.

Better: keep markup and colors in the island template and translate only the text (`进入 [{{}}]`). This changes catalog keys, so do it together with glossary updates, one panel at a time.

## 7. `window.*` globals and `onclick="..."` strings

Ported islands import handlers directly now (`start_dialogue`, `start_activity`, ...). The `window.x = x` block at the end of main.js remains for the HTML that still uses inline `onclick`. Remove each assignment once `grep` shows no string caller left.

## 8. Coarse computeds

`LocationActions.vue` builds all rows in one computed. With a job at the location, `can_work` reads game time, so every tick rebuilds every row and re-runs `getActivityEfficiency` for the gathering tooltips. It is cheap at this size. If a panel grows, split it into one computed per category or row so a clock tick only touches what depends on the clock.

## 9. Minigames stay imperative, on purpose

Fishing (both kinds), grass, digging, reactor, engine and piston run 33 fps physics loops in main.js that write a few `style` properties straight to their elements each frame. That is already the cheapest way to draw them. Routing per-frame positions through reactive state and a Vue render would cost more and gain nothing, so they are not ported.

Worth fixing there instead: the second fishing game converts mouse position with hardcoded page offsets (`731.5`, `483.5` in `start_fishing_minigame_changed`), so any layout change moves the rod's target. Use `getBoundingClientRect()` of `#fish_changed_div`.
