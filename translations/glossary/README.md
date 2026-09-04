# Handcrafted English glossary

These JSON files provide canonical Chinese-to-English anchors for terms that are frequently emitted as compounds or are absent from the generated glossary. They are grouped into ranks, items, locations, and general game terms.

Normalization decisions:

- `剑柄` is standardized as **Sword Hilt** (rather than alternating “handle”/“hilt”); `剑刃` is **Sword Blade**.
- `充能` is **Charged** everywhere, including weapon names; this supersedes the generated “Energized” variant.
- `精钢` is **Fine Steel** and `紫铜` is **Purple Copper**; this preserves the distinction between refined steel and ordinary iron/steel descriptions.
- `荒兽` is **Wild Beast**; `凶兽` is **Fierce Beast**. Compound meat names use a hyphenated modifier (for example, **Dungeon Wild-Beast Meat**).
- `潮汐级` is **Tidal Rank**; “Tide-Grade” is not used.
- `云霄级` is **Ascendant Rank** because that is the existing translation of its peak form. `凌空级` remains **Sky-Soaring Rank** as a distinct rank.
- `地宫` is **Dungeon** in names, while `飞船中枢` is **Spaceship Hub** (distinct from `飞船核心`, Spaceship Core).
- `黑森` and `黑暗森林` are retained as distinct source names: **Black Forest** and **Dark Forest**.
- `声律城` is standardized as **Shenglv City**; the generated “Shenlv City” spelling is treated as a typo.
- `战靴` is **Boots**. “Sabatons” and “battle boots” are not retained as variants.
- `百家` is treated as the proper faction name **Baijia**, rather than the literal “Hundred Clans”.
- `青花鱼` means **Mackerel** (not “Blue Flower Fish”).
- `精钢` is **Fine Steel**; this is more specific than the generic **Steel** used by some generated item strings.

`brackets.json` is the complete 316-entry glossary for every Chinese `【…】` term extracted from the game. Unlike the compositional files, it intentionally keeps complete bracket phrases (including compounds and contextual UI messages), because bracket replacement uses longest-key matching.

These are intentional canonical anchors, not a replacement for the generated catalogs.

## Non-splitting rule

Never invent a translation by splitting a Chinese key into smaller components. A
longer term stays a complete glossary key. Its translation may reference another
already-known complete glossary substring, but the generator must not synthesize
new wording by mechanically composing atomic pieces. When terms overlap, the
longest complete glossary match wins.
