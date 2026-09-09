# Uncommitted work: intent, progress, and commit plan

## Decision

Do not commit the whole working tree, and do not wait for the whole Vue migration to finish. There are two distinct efforts here: a translation-source extraction and a substantial first batch of UI migrations. The UI effort has reached a useful checkpoint; the translation effort has overshot its intended scope.

Use three coherent implementation commits: a static translation snapshot, reactive state preparation, and the current leaf-panel migration. Do not reconstruct six separate historical island commits for this backlog. After this checkpoint, return to one completed vertical slice at a time.

This is an intent/progress review, not a release certification. No implementation changes or staging were performed for this review.

## Intent confirmed with you

- Prefer a few coherent commits over reconstructing one commit per existing island.
- The destination is still a full migration of painted UI into Vue, not permanent selective islands.
- The userscript slice should produce exactly one static JSON file, analogous to the old translation-branch snapshot.
- That JSON should be a flat Chinese-to-English catalog.
- It should not be fed into the glossary or processed further as part of this slice.
- A reusable merge tool, vocabulary rewrite project, and glossary import are not the requested translation deliverable.

## Why the working tree looks so large

The initial tracked diff reports 11,813 additions and 11,804 deletions across 22 files. Ignoring end-of-line whitespace reduces this to 1,100 additions and 1,091 deletions. In particular, `src/main.js` and `src/display.js` contain line-ending churn that makes their edits look like wholesale rewrites.

Neither count includes the new Vue components, plans, importer, or enemy glossary. The backlog is real, but the initial 23,617-line figure overstates the substantive tracked changes substantially.

At inventory time, nothing was staged. `AGENTS.md` also appeared as untracked despite the project context describing it as locally excluded. Keep it out of these commits; do not use `git add .`.

## Progress by workstream

### 1. Vue migration: a real first batch, not just scaffolding

The following panels have their new component, host cutover, and removal of their principal old painters in the pending work:

| Panel | New ownership | Assessment |
| --- | --- | --- |
| Basic character info | `BasicInfo.vue`, `Bar.vue` | Name editing, XP, HP, Deadline tint, and ranking have moved together. A coherent leaf migration. |
| Statistics and bank | `DataBox.vue` | XP multipliers, kill/craft counts, and withdrawal buttons have moved. Tied to reactive counter work. |
| Options | `Options.vue` | Checkboxes, backup label/action, and reset UI have moved. Game-side persistence and audio/number-format effects remain in the integration. |
| Combat management | `CombatManagement.vue` | Selected stance, favourites popup, attack progress, and overcharge have moved. The full stance table remains intentionally legacy. |
| Location description | `LocationDescription.vue` | Description and S3 HUD have moved. Separate from the much larger location-actions migration. |
| Equipment and tools | `Equipment.vue`, `Tools.vue`, `EquipmentSlot.vue`, `ItemTooltip.vue` | Slot display, unequip action, and tooltip ownership have moved. This is the most substantial component conversion in the batch. |

This is a sensible checkpoint. It removes genuine DOM ownership from `index.html`, `display.js`, and `main.js` rather than mounting components beside duplicate live painters.

The work is nevertheless coupled: panels share `game_state`, `Bar`, tooltip components, exports, aliases, CSS removals, and translation entries. That is why one current-batch UI commit is more practical than retroactively manufacturing the original per-island history.

### 2. Reactive state: useful preparation, with a temporary architectural cost

The patch makes singleton data reactive (`skills`, `enemy_killcount`, flags, options, favourites, family, infinite-combat data, and trade selections), introduces `game_state`/`trade_state`, and preserves reactive roots when loading replacement contents.

The two-line pattern for reassigned bindings is deliberate:

```js
game_state.current_enemies = enemies;
current_enemies = game_state.current_enemies;
```

Reading back through the proxy allows existing gameplay code to mutate tracked nested state. This is more than a repaint trigger, and it supports the intended full migration.

The cost is duplicated access paths. Every reassignment must continue to synchronize both names. Accept this as a transitional boundary, not the permanent end state. Later, when consumers migrate, remove the corresponding legacy binding and make the reactive holder authoritative. Do not turn this checkpoint into a repository-wide state rewrite.

Also distinguish reactive access from raw access. The documentation correctly leaves template tables raw, but its broad reassurance about reactive state should not imply that mutations through raw `locations`, `traders`, or `stances` are tracked merely because an island can reach a proxy of an object. Each later list migration still needs to identify its actual mutation paths.

### 3. Message log: the next slice has started too early

`MessageLog.vue` is present, but its producer and host migration have not landed. This is unfinished work, not a reason to finish every list before committing the leaf panels.

There is an important coupling, though: `src/boot.js` eagerly imports every island. The new component imports `messages` from `game/display`, while `src/display.js` does not export it. An absent host does not isolate an eager module import.

**Checkpoint decision:** exclude this draft from the leaf-panel commit. Park it outside the eager island input directory while finishing that checkpoint, or complete it as its own next slice. Do not add a dummy export just to make the draft load.

No file was moved or deleted during this review.

### 4. Translation extraction: substantial work, wrong deliverable

`tools/merge-userscript.ts` and `docs/translation-merge.md` describe a much larger operation than the one you intended:

- matching userscript DOM keys to current source strings;
- comparing against compiled and original catalogs;
- joining translated lines;
- converting regexes and template expressions;
- normalizing vocabulary;
- selecting overwrites;
- routing accepted entries into multiple glossary files.

The pending glossary edits are the output of that expanded effort. Their size and the detailed merge report do not make them part of the requested static extraction.

**The missing artifact is the single flat snapshot itself.** Do not commit the importer and bulk glossary changes under an extraction commit message. They are different deliverables.

For the intended snapshot:

- Use a sibling of `translations/source/catalog.raw.json`, for example `translations/source/userscript.raw.json`.
- Keep actual Chinese-to-English lookup entries, with source English intact. Do not apply the glossary substitution table.
- Exclude runtime code, CSS/UI customizations, reverse lookup helpers that are not needed to supply Chinese-to-English entries, and regex transformations that cannot honestly be represented as literal lookup keys.
- Where tables disagree on a Chinese key, choose and record explicit source-table precedence during extraction. A flat object cannot preserve conflicting values for the same key; this is an extraction decision, not permission to normalize wording.
- Do not wire the snapshot into `tools/generate.ts`, the glossary, or the runtime.
- Record source version, provenance, extraction precedence, and any distribution/attribution requirements in the commit body so this slice can remain one JSON file.

The source version currently described in the merge document is dragonayzer's localizer v16.7. This review did not independently establish its redistribution terms or inspect the original userscript.

### 5. Imported glossary work: preserve separately, do not silently approve

Most changes to `activities.json`, `dialogues.json`, `items.json`, `locations.json`, `skills.json`, `ui.json`, and the new `enemies.json` belong to the expanded merge, not to the Vue migration. The terminology edits in `brackets.json`, `enemy_specs.json`, `terms.json`, and portions of `templates.json` are also a separate editorial decision.

Do not delete this work as a side effect of splitting commits. Preserve it in a labelled local patch/archive or another explicitly separate work area before taking it out of the active backlog. An archive is preservation, not a disguised merge-ready commit.

Retain only the small glossary subset actually required by the new UI in the UI commit. Examples include the ranking and backup-label skeletons, Soul Power/remaining-enemies text, the bank label, option prompts, and tooltip labels/slot skeletons. `templates.json` and `ui.json` need hunk/key-level separation rather than whole-file staging.

The merge report can be preserved with the expanded experiment, but should not become the authoritative account of the new snapshot-only slice. It describes glossary compilation and acceptance decisions that the intended slice does not make.

## Readiness notes already observed

These are bounded notes from reading the pending work, not a request to broaden the project before committing.

### Must resolve at the current UI boundary

1. **Eager MessageLog import requires a missing export.** `MessageLog.vue` imports `messages`; `display.js` has no such export. This is a module-linking problem even without a message-log host. Keep the unfinished island out of the checkpoint rather than providing a fake implementation.
2. **Structured item tooltips lost markup handling for descriptions.** `ItemTooltip.vue:39` adds `getDisplayDescription()` as ordinary text, and the template at lines 173–175 interpolates ordinary parts. The previous renderer inserted descriptions as HTML (`display.js:255–256`). Existing descriptions in the pending catalogs contain `<br>` and other markup. The new display would show those tags as text instead of preserving their presentation. Preserve supported description formatting without reverting the entire tooltip to a monolithic HTML string. The finished-book rewards branch has the same plain-text treatment of `format_rewards`; account for that when this shared component is reused for books.

### Separate translation/editorial issues, not UI blockers

- `translations/glossary/dialogues.json:39` translates `不要再继续成长了。` as `growing stronger.` The prohibition has disappeared. This is a concrete reason not to treat the imported prose as automatically approved.
- `items.json:233` adds `精钢剑` as `Steel Sword`, contrary to the documented Fine Steel terminology.
- `skills.json:55` changes `水无心` to `Water Heartless`, while existing compound entries in dialogue still use `Waterless Mind`. Renaming a base display term is not a completed terminology cutover by itself.
- The importer reads substitution and overwrite decisions from optional `.tmp/merge/*.json` inputs. Committing just the TypeScript file would not preserve the reported operation. With the clarified snapshot-only intent, retaining and productizing that importer is unnecessary.

### Follow-up quality, not reasons to delay the checkpoint indefinitely

- Remove empty conditionals left after painter deletion, such as the XP-bonus branch in `character.js` and regeneration-display branch in `main.js`, when preparing their owning commit.
- Avoid accumulating tombstones for each removed painter. Keep comments that explain a live transitional contract; the commit history records deletions.
- Update `docs/migration-plan.md` so the current batch is complete only after its commit, and MessageLog is explicitly in progress rather than implicitly included.
- Move stable architectural rules to `docs/islands.md`; keep the status board about order, ownership, and remaining work. Historical line numbers and local `.tmp` inventories should not be necessary to understand a task.

## Commit sequence

### Before staging: preserve and separate, without committing everything

1. Preserve the current work before rearranging shared-file hunks. Keep the translation merge experiment and MessageLog draft recoverable.
2. Remove end-of-line-only churn from the patches being committed, preserving actual edits. Do not add a repository-wide formatting or line-ending policy change to this work.
3. Stage explicit paths/hunks. Leave local agent instructions and unrelated work out.
4. Do not create an all-inclusive WIP commit on the main development line merely to obtain a clean status.

This is a proposed execution plan. No preservation, rearrangement, staging, or commits have been performed here.

### Commit 1 — `chore(i18n): snapshot userscript translation catalog`

**Scope:** one new flat JSON file under `translations/source/`.

**Include:** extracted Chinese-to-English literal lookup data only. Source/version and collision precedence go in the commit body.

**Exclude:** `tools/merge-userscript.ts`, `docs/translation-merge.md`, bulk glossary additions, terminology rewrites, generator integration, and compiled translation output.

**Ready when:** the snapshot exists and satisfies the clarified extraction contract. The current glossary output is not a substitute for this artifact.

This commit is independent of Vue and can be done before or after the UI pair without changing their behavior.

### Commit 2 — `refactor(state): expose reactive state for UI islands`

**Scope:** the state bridge and singleton reactivity, while preserving existing UI behavior at this intermediate point.

**Include:**

- Reactive singleton changes in `main.js`, `skills.js`, `enemies.js`, and `trade.js`.
- The paired assignment/readback paths for reassigned state.
- In-place replacement for family and infinite-combat save data.
- The matching state-contract update in `docs/islands.md`.

**Do not include yet:** host replacement, old painter removal, option-handler removal, or removed exports still used by the old UI.

**Important split boundary:** total-counter migration is coupled to DataBox and the old display imports. Keep existing counter bindings/exports until Commit 3 migrates their consumers; move that counter change with DataBox rather than committing a temporarily broken export graph. Likewise, keep the old attack-bar call until its consumer is replaced.

**Ready when:** this intermediate commit is still the legacy UI, backed by the new reactive state where introduced. New aliases for components can wait for Commit 3. No compatibility shims need to be invented just to force the split.

### Commit 3 — `refactor(ui): migrate the first leaf-panel batch to Vue`

**Scope:** all six current panel groups, together with the shared components and final consumer cutovers they need.

**Include:**

- `Bar.vue`, `EquipmentSlot.vue`, `ItemTooltip.vue`.
- `BasicInfo.vue`, `DataBox.vue`, `Options.vue`, `CombatManagement.vue`, `LocationDescription.vue`, `Equipment.vue`, `Tools.vue`.
- Matching hosts and inline-handler removals in `index.html`.
- Component import aliases in `islands.config.js` and the host import map.
- Remaining painter/caller/export removals in `display.js`, `main.js`, `character.js`, and `locations.js`.
- Counter migration, attack-progress delivery, and option side effects that belong to these consumer cutovers.
- Only CSS made obsolete by these panels.
- Only the glossary keys needed by these panels.
- The migration status board, with an accurate checkpoint and remaining-work section.

**Exclude:** `MessageLog.vue`, bulk translation import, terminology project, unrelated whitespace cleanup, generated `ui/`, and generated English catalogs/pages. Generated artifacts are ignored by the existing repository policy; do not force-add them merely because the roadmap says “build.”

**Ready when:** none of these hosts has a second active DOM owner, none depends on an unfinished eager import, and the tooltip presentation regression above has been addressed. This is a leaf-panel checkpoint, not a claim that lists, inventories, trade, or minigames are migrated.

The review file itself is optional documentation in this commit, or can remain a local planning artifact. It should not force another implementation commit.

## What should remain after the checkpoint

A clean active backlog should contain the next intentional slice, not a mixture of future UI and an unwanted translation merge.

- The static userscript snapshot is committed but unused by the translation pipeline.
- The mounted leaf panels and their reactive foundations are committed.
- Bulk glossary-merge work is preserved separately, not implicitly approved or left mixed into the active UI tree.
- MessageLog is the next UI slice, with producer, host, filtering, retention, scroll behavior, and legacy cleanup committed together.
- The rest of the full migration remains a roadmap, not a requirement to start all its files now.

## How to avoid another backlog

1. Start one migration slice; identify state, display ownership, actions, translation keys, and CSS before editing.
2. Finish that slice through removal of its old live painter. Do not start the next eagerly imported island while its data producer is absent.
3. Commit at that vertical boundary. “The full migration is unfinished” is not a reason to withhold a complete panel commit.
4. Keep cross-cutting editorial work separate. A UI port should not become a translation import or naming-policy change.
5. Keep the roadmap short and current. The next task should be apparent without reading local investigation artifacts.

## Review limits and actions already taken

I read the substantive tracked diff and the new implementation/planning files in batches. Before you clarified the review scope, I ran `bun run build:islands`; it passed and regenerated ignored UI output. A server launch failed because port 4173 was occupied; I did not pursue it or open Chrome. I also inspected the export list and checked for duplicate keys across glossary files; there were no cross-file duplicates.

Those checks do not establish runtime correctness. After your clarification, no further execution checks were performed. The recommendations above are grounded in the code, the documented progress, and your confirmed intent; they do not certify combat, save/load, tooltip layout, or later-game UI behavior.
