# Migrating UI to islands

Islands are Vue Vapor components that replace a piece of the existing DOM.
The rest of NekoRPG stays browser-native ES modules: no bundler, no rewrite of
`src/main.js` / `src/display.js` except the few lines that used to paint that
piece.

`src/islands/TimeAndLocation.vue` and `src/islands/CharacterStats.vue` are the
references. Copy those patterns, not a new one.

## Layout

| Path | Role |
| --- | --- |
| `src/islands/*.vue` | One file per mount point. Always loaded. |
| `src/components/*.vue` | Shared widgets (e.g. `Tooltip.vue`). Only bundled if an island imports them. |
| `src/boot.js` | `uno.css` + `mountIslands(...)`. Compiled to `ui/boot.js`. |
| `islands.config.js` | What to compile, and which game modules islands may import. |
| `plugin/` | Vite boundary, mount helper, build. Do not import this from game code. |
| `ui/` | Generated. Gitignored. Do not edit. |

`index.html` loads `src/main.js` first, then `ui/boot.js`. The game finishes
evaluating before any island mounts.

Islands and game modules share **one** reactivity instance. `ui/vue.js` is
built with `@vue/reactivity` external, so it and `src/game_time.js` both
resolve that specifier to `ui/reactivity.js` through the import map. A second
copy would keep working and silently stop tracking. The same holds for game
modules: `game/display` and `./src/display.js` are the same URL, so an island
and `display.js` share one module record and a reactive holder can be
exported from `display.js` and imported back by the island.

## Commands

```
bun install
bun run build:islands
bun run compile          # only if index.html changed; en.html is generated
node tools/serve.mjs 4173
```

Rebuild after changing an island, a component, `islands.config.js`, or Uno
theme. `ui/` must exist: `src/game_time.js` already imports `@vue/reactivity`,
so the game will not boot without `ui/reactivity.js`.

`build:islands` stamps the import map into `index.html`, and prints the `vue`
bindings it collected. `runtimeExports` in `islands.config.js` is only a seed —
anything an island imports from `vue` is added automatically. That printed list
is also a cheap diff: dropping `v-html` made `setHtml` vanish from it.

GitHub Pages runs `bun run build:islands` before `compile`.

## Recipe

Take one existing box (time, location name, a bar, a list). Do not migrate
half of `display.js` at once.

### 1. Name the island

`src/islands/StatBars.vue` mounts on every `data-island="stat-bars"`.
The name is the file name in kebab-case. One component per name.

### 2. Put a mount point in `index.html`

Reuse the element the old CSS already targets. Prefer the box root over an
inner child:

```html
<div id="time_and_location" class="box_div" data-island="time-and-location"></div>
```

The host keeps its id, class, and stylesheet. Everything inside is the
island's: give inner elements new prefixed ids (`#tal-time`,
`#tal-location-name`, …) so no old rule can reach them, style them with Uno,
and delete the orphaned CSS. Legacy absolute/float positioning does not
survive the move — lay the inside out with flex or grid.

Do not wrap the host in extra Uno chrome that duplicates its own rules.

### 3. Write the component

```vue
<script setup vapor>
import { computed } from 'vue'
import { current_game_time } from 'game/game-time'

const label = computed(() => current_game_time.toString())
</script>

<template>
  <span>{{ label }}</span>
</template>
```

Rules:

- `<script setup vapor>`. Options API is compiled out.
- Import Vue from `vue`, reactivity-only APIs from `vue` or `@vue/reactivity`.
- Import game modules by the aliases in `islands.config.js`, never by
  relative `../main.js`.
- Translate at the display boundary: `` t`...` `` or `t(location.name)`.
  Do not rewrite `.name` / ids. Those go into saves.
- Shared widgets live in `src/components` and are imported relatively
  (`../components/Tooltip.vue`).

### 4. Expose game state to Vue

Vue only sees mutations that go through a reactive proxy. Wrap the
**instance**, not the class:

```js
import { reactive } from "@vue/reactivity";

function Game_time(new_time) { /* unchanged */ }

const current_game_time = reactive(new Game_time({ ... }));
export { current_game_time };
```

Do this at the singleton export (two lines per object). Do **not**
`class Foo extends Reactive` and do **not** `return reactive(this)` from a
constructor.

Then `computed(() => current_game_time.hour)` and methods that read `this.hour`
on that same object will invalidate.

Reassigned `let` bindings are invisible. This does **not** work:

```js
import { current_location } from "game/main"
computed(() => current_location)              // never re-runs
```

Every reassigned `let` in `main.js` has a mirror key on `game_state`
(`current_location`, `current_enemies`, `current_activity`, `current_dialogue`,
`current_stance`, `selected_stance`, `is_resting`, `is_sleeping`, `is_reading`,
`last_location_with_bed`, `last_combat_location`). `trade.js` has the same
thing as `trade_state.current_trader`. The write pattern is two lines:

```js
game_state.current_enemies = enemies;
current_enemies = game_state.current_enemies;   // the let now holds the proxy
```

Reading back through the holder matters. The `let` then points at the proxy,
so in-place writes through it (`current_enemies[i].stats.health -= dmg`) are
tracked too, not only the swap. Never write the `let` directly. Game code keeps
reading the `let`; islands read `game_state`. This is safe because nothing
compares those lets by object identity (all checks are on `.name` or ids).

Save blobs that `load()` used to replace wholesale (`inf_combat`,
`family_data`) are `const reactive(...)` now. Replace their contents with
`replace_contents(target, src)` instead of reassigning. Same rule for anything
new: wrap the singleton, never swap the binding.

Prefer making the underlying game object reactive over signalling a repaint.
`character` is `reactive(new Hero())` at its export, so every island binding
that reads `character.stats.full`, `character.xp` or `character.equipment`
invalidates on its own and `update_displayed_stats` lost its whole body. Same
for `active_effects` in `main.js`. Wrapping the singleton is two words and
leaves no second source of truth to drift.

This is safe on hot, deeply mutated objects. `reactive()` is deep, so nested
writes (`character.stats.flat.equipment.attack_power = …`) track as long as
they go through the singleton. Proxies keep the prototype chain, so
`instanceof` and class methods still work, and `JSON.stringify` in
`create_save()` sees plain data. Untracked reads outside an effect cost one
proxy hop. Check for `===` identity comparisons against raw objects before
wrapping a collection of instances: there are none for items, so equipment and
inventory can be deep.

The object has to be wrapped where it is created and never reassigned
afterwards — `load()` mutates `character` in place, so the proxy survives a
load. A `let` that gets replaced needs a holder instead (see above).

Already reactive: `character`, `active_effects`, `skills`, `global_flags`,
`options`, `message_log_filters`, `faved_stances`, `inf_combat`,
`family_data`, `to_buy`, `to_sell`, `current_game_time`, and everything on
`game_state` / `trade_state`. Template tables (`item_templates`, `locations`,
`enemy_templates`, `dialogues`, `recipes`, `traders`, `stances`) stay raw.

For a read that genuinely cannot be tracked, give the holder a counter and
bump it from the updater that used to repaint that box:

```js
const location_panel = reactive({ current: null, combat: false, pulse: 0 });

function update_displayed_location_types(location) {
    location_panel.current = location;
    location_panel.pulse++;
}
```

```js
const types = computed(() => {
  location_panel.pulse
  return describe(location_panel.current)   // reads character.inventory, skills, …
})
```

The island then repaints exactly when the old code did. `location_panel.pulse`
is a leftover from before `skills` and `inf_combat` were reactive and can go
once nothing reads it.

### 5. Declare game imports

If the island (or a component) imports a game file, add it to
`islands.config.js`:

```js
export const imports = {
  'game/game-time': { source: 'src/game_time.js', url: './src/game_time.js' },
  'game/t':         { source: 'src/i18n.js',      url: './src/i18n.js' },
}
```

`bun run build:islands` stamps the import map in `index.html` from this
object. Missing aliases fail the build. Do not add `src/islands` or
`src/components` here — those are compiled, not mapped.

Relative imports of game files (`../../src/i18n.js`) also need an alias for
that source path. Use the `game/...` specifier instead.

### 6. Delete the old paint

Comment out the `innerText` / `innerHTML` / `createElement` for that box, and
keep the original lines:

```js
/** replaced by the TimeAndLocation island (`src/islands/TimeAndLocation.vue`, `data-island="time-and-location"`)
 * time_field.innerHTML = current_game_time.toString();
 */
```

Keep any extra work that lived in the same updater (the export-save-button
timer in `update_displayed_time`, etc.). Watch for logic that was tangled
into the paint — a `log_message` inside a loop that also computed a displayed
number has to stay in `display.js` while the island recomputes the number,
and the two copies then drift.

The old CSS and event handlers are part of the old paint. Reprefixing the ids
orphans the `style.css` rules that targeted them, the `--*_tooltip_*`
variables that fed them, and the `mousemove` handlers in `index.html` that set
those variables. Delete all of it in the same change instead of guarding it
with `if (element)`.

### 7. Rebuild and look

The island should match the old pixels, minus whatever you intentionally
changed. Then delete the dead innerHTML / `createElement` for that box only.

## Props from HTML

Optional. `data-*` becomes a prop; `data-island`, `data-mounted`,
`data-island-error`, and `data-props` are reserved.

```html
<div data-island="price" data-amount="12" data-props='{"suffix":"C"}'></div>
```

Numbers and booleans coerce from the component's `defineProps` types.
Unions stay strings. Use `data-props` JSON when you need a real object.

Most game islands will ignore this and read reactive singletons instead.

## Components that decorate a host

`Tooltip.vue` does not wrap its target. It renders a `hidden` anchor span,
takes `anchor.parentElement` on mount, and binds its listeners there:

```vue
<div id="tal-location-name">
  {{ name }}
  <Tooltip :disabled="!description">
    <template #content>{{ description }}</template>
  </Tooltip>
</div>
```

Any element becomes the hover target by adopting a `<Tooltip>` child, with no
wrapper left in the flex or grid flow. It marks the host `data-has-tooltip`
so devtools can find them all, and unbinds in `onScopeDispose`. The cost is an
implicit dependency on the DOM parent: it breaks if the component is used as a
root node with no element parent.

Overlay positioning, learned the hard way:

- Position the bubble `fixed` and place it from JS. It can live inside a flex
  container because it is out of flow.
- Follow the cursor with `mousemove` on the host, throttled to one
  `requestAnimationFrame`. The legacy handlers used a 60/sec timestamp gate.
- The arrow cursor's hotspot is its tip, so the glyph only covers pixels down
  and to the right of the reported coordinate. Above the cursor needs no
  clearance; below needs ~20px.
- Latch the above/below flip for the duration of a hover. Recomputing it every
  frame makes the bubble oscillate as the pointer crosses the threshold.
- Anchoring vertically to the host rect instead of the cursor sounds more
  correct and is worse in practice: on a wide host the bubble lands far from
  the pointer. Tried, reverted.
- Extrapolating the cursor to cancel the frame of lag is not worth it. It
  overshoots on every stop and reversal. Tried, reverted.
- Pass content through a named slot, not an HTML string prop. `v-html` on game
  text is an injection surface for no benefit, and structured data renders
  better than string-concatenated `<br>`s.

## Translation

`tools/split-catalog.ts` and `tools/extract-template-keys.ts` scan
`src/islands/*.vue` and `src/components/*.vue` as well as `src/*.js`. A `.vue`
file is read as JavaScript chunks: the `<script>` block plus every `{{ }}`
interpolation (`vueChunks` in `tools/collect.ts`). Strings in attribute
bindings are not collected.

Static Chinese in `index.html` is translated by `generate-en-html.ts` from the
HTML catalog. Moving that text into an island drops it out of the HTML catalog,
so it has to come back as a `t()` lookup — otherwise the string silently
reverts to Chinese on `en.html`. Run `bun run compile` and grep the new
`translations/gen/by-source/<Island>.json` for `<?>`.

``t(`境界 : ${name}`)`` is a whole-string lookup that can never hit. Use the
tagged form `` t`境界 : ${name}` `` so the skeleton `境界 : {{}}` becomes the
key; compute it in `<script>` and bind the result.

## CSS

- Existing `#id` / `.box_div` rules stay in `style.css` on the host.
- New layout inside the island: Uno utilities (`presetWind4`, no preflight
  reset, so game CSS is not wiped).
- No preflight reset means `border` sets the *width only*. With no border
  style the element paints nothing. Write `border border-solid`,
  `border-b-1 border-b-solid`.
- Theme tokens that already exist as CSS variables can be named in
  `uno.config.js` (`tooltip: 'var(--tooltip_background_color)'`).

## What not to do

- Do not import `game/main` just to read `current_location` / `options` /
  `character`. Those are `let`s and circular. Re-export a reactive object
  from a small module, or wrap the singleton where it is created.
- Do not poke `current_game_time.minute` to fake invalidation for some
  other binding.
- Do not put game logic in `plugin/` or compile `src/*.js` by adding them
  to `internals`. Internals are Vue files only.
- Do not commit `ui/`.
- Do not rename template `.name` / ids to English. Translate at render.

## Checklist for a new island

1. `src/islands/FooBar.vue` with `<script setup vapor>`
2. `data-island="foo-bar"` on the existing host in `index.html`
3. `reactive(instance)` at the game export the island reads, and a glossary
   entry for every Chinese string that left `index.html`
4. Alias that module in `islands.config.js` if not already there
5. Replace old `update_displayed_*` writes with a comment pointing at the island
6. Delete the CSS rules, CSS variables and `index.html` handlers that box left behind
7. `bun run build:islands`, then `bun run compile` if `index.html` changed
