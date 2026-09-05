# Migrating UI to islands

Islands are Vue Vapor components that replace a piece of the existing DOM.
The rest of NekoRPG stays browser-native ES modules: no bundler, no rewrite of
`src/main.js` / `src/display.js` except the few lines that used to paint that
piece.

`src/islands/TimeAndLocation.vue` is the reference. Copy that pattern, not a new one.

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

## Commands

```
bun install
bun run build:islands
node tools/serve.mjs 4173
```

Rebuild after changing an island, a component, `islands.config.js`, or Uno
theme. `ui/` must exist: `src/game_time.js` already imports `@vue/reactivity`,
so the game will not boot without `ui/reactivity.js`.

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
import { current_location } from 'game/main'
computed(() => current_location)              // never re-runs
computed(() => { current_game_time.minute; return current_location }) // stale on travel
```

For something `change_location` replaces, export a reactive holder and write
it there:

```js
export const location_state = reactive({ current: null })
// in change_location:
location_state.current = location
```

Islands import that holder, not a live `let` from `main.js`. Prefer a small
module over teaching islands to import `game/main`.

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
timer in `update_displayed_time`, etc.).

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

## CSS

- Existing `#id` / `.box_div` rules stay in `style.css` on the host.
- New layout inside the island: Uno utilities (`presetWind4`, no preflight
  reset, so game CSS is not wiped).
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
3. `reactive(instance)` at the game export the island reads
4. Alias that module in `islands.config.js` if not already there
5. Replace old `update_displayed_*` writes with a comment pointing at the island
6. `bun run build:islands`
