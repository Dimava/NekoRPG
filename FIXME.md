# FIXME: style debt in the Vue port

Notes on where the current port style is weaker than it could be. These are not bugs. Each one is a pattern that will grow if copied into more panels.

## 1. Tombstones and empty stubs (done, keep it that way)

`display.js` used to hold `function update_displayed_money() {}`, `update_displayed_enemies() {}`, `add_bestiary_tooltip() {}` and 18 more, plus `/** replaced by the X island ... */` blocks quoting the deleted code, and main.js kept calling them. Those are gone, and so are the repaint-only functions (`update_displayed_character_inventory`, `update_displayed_trader_inventory`, `update_displayed_stance_list`, `update_displayed_book`, `start_*_display`, ...) that reactivity made pointless.

For future ports: delete the stub, its import and every call site in the same commit that ports the panel. Git history already records what was there. A stub that nothing needs is a trap for the next reader, who has to check whether it does anything. `.scratch/drop-stubs.ts` does this mechanically.

## 2. `pulse++` counters (done)

The pulses existed because `dialogues`, `traders`, `activities`, `locations`, `stances` and `book_stats` were plain objects. They are now `reactive()` where they are defined, like `skills` and `character`, and every pulse is gone. Islands track `is_unlocked`, `is_finished`, trader stock and reading progress directly.

`item_templates` and `enemy_templates` stay plain on purpose. They are large, read on the combat hot path, and their fields do not change during play. If one ever starts mutating at runtime, make it reactive instead of adding a pulse. Watch for identity comparisons against raw objects; `toRaw` fixes those.

## 3. View mode as "last setter wins" (done)

`LocationActions.vue` used to show whichever `start_*_display` ran last, which could disagree with the game (after sleeping while reading, the book kept progressing with no "stop reading" button). The mode is now a computed over `game_state` (`current_dialogue`, `current_activity`, `is_sleeping`, `is_reading`, `current_location`) plus the UI-only `action_panel.expanded` category. main.js no longer calls a display function to switch it.

## 4. The `game_state.x = v; x = game_state.x` mirror (done)

main.js used to keep live state twice, as a module `let` and in `game_state`, with a two-line write at each assignment. The `let`s are gone. main.js, character.js and display.js read and write `game_state.x` directly. Do not reintroduce a local copy: an exported `let` is a snapshot to importers and invisible to islands.

Note that `game_state` fields start at `null` where some of the old `let`s started at `undefined`. Test them for truthiness or `== null`, not `typeof x === "undefined"`.

## 5. Game logic inside display functions

The goto2-5 trip (distance, time skip, location unlock) lived in `update_displayed_ongoing_activity`. It is now `travel_to_shenglv()` in main.js. Expect the same thing in the minigames and crafting code: anything that mutates `character`, `inf_combat`, time or inventory belongs in main.js before the view is ported.

## 6. HTML strings (done for code, by design for content)

No code builds HTML strings any more, and nothing uses `v-html` or `innerHTML`:

- Tooltips, rows, money and stat lists are templates and components (`Money`, `RecipeTooltip`, `JobTooltip`, `GatheringTooltip`, `ItemTooltip`). Keys like `进入 [{{}}]` carry no icons or colors.
- Game text goes through `Rich.vue`, which renders a whitelist of inline markup (`br b i span div del img`, attributes `class style src`) as Vue nodes. Code that needs a component inside a translated sentence uses `` tx`钱包: ${as_money(n)}` ``: same catalog key as `t`, but it returns parts instead of a string.
- Authored text keeps its inline markup: descriptions, dialogue, textline answers, realm-colored names in log lines. The catalog translates those strings markup and all, so rewriting them would invalidate thousands of entries for no visible change.

Do not add new `<span style=...>` or `<br>` to a key that code assembles. Put structure in the template, or return parts (`{br: true}`, `{text, cls}`, `{money}`) for log lines.

Leftover: display.js still imports about thirty names it no longer uses. Removing them can change module evaluation order in the circular import graph, so do it with an in-game test, not blind.

## 7. `window.*` globals and `onclick="..."` strings

Ported islands import handlers directly now (`start_dialogue`, `start_activity`, ...). The `window.x = x` block at the end of main.js remains for the HTML that still uses inline `onclick`. Remove each assignment once `grep` shows no string caller left.

## 8. Coarse computeds

`LocationActions.vue` builds all rows in one computed. With a job at the location, `can_work` reads game time, so every tick rebuilds every row and re-runs `getActivityEfficiency` for the gathering tooltips. It is cheap at this size. If a panel grows, split it into one computed per category or row so a clock tick only touches what depends on the clock.

## 9. Minigames stay imperative, on purpose

Fishing (both kinds), grass, digging, reactor, engine and piston run 33 fps physics loops in main.js that write a few `style` properties straight to their elements each frame. That is already the cheapest way to draw them. Routing per-frame positions through reactive state and a Vue render would cost more and gain nothing, so they are not ported.

Worth fixing there instead: the second fishing game converts mouse position with hardcoded page offsets (`731.5`, `483.5` in `start_fishing_minigame_changed`), so any layout change moves the rod's target. Use `getBoundingClientRect()` of `#fish_changed_div`.
