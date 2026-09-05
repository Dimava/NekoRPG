/**
 * Loads a save made on an English build.
 *
 * That build translated `name` in place, so its saves carry English identity:
 * "current location" is "Light Barrier Space", enemy_killcount is keyed by
 * "Frost Wolf", equipment holds English item ids. None of it resolves here, and
 * the game does not merely drop the content: change_location() reads `.bgm` off
 * an undefined location and the whole load aborts.
 *
 * So translate it back on the way in: replace every string in the save that the
 * id map knows. A Chinese save is untouched and a second pass is a noop, both
 * for the same reason -- the map's keys are English and its outputs are Chinese.
 *
 * The map is data, not the translation catalog, so this works on the Chinese
 * page too: it also has to import English saves, and it never loads a catalog.
 */

import { foreign_ids } from "./en/save_ids.js";

// Inventory keys are JSON: {"id":"铁剑","components":{"head":"铁剑刃"}}. The id and
// every component are item ids, so they need the same treatment as any string.
function repair_key(key, seen) {
    if(!key.startsWith("{")) return repair(key, seen);
    let parsed;
    try { parsed = JSON.parse(key); } catch { return key; }
    return JSON.stringify(walk(parsed, seen));
}

function repair(value, seen) {
    const zh = foreign_ids[value];
    if(!zh) return value;
    seen.add(`${value} -> ${zh}`);
    return zh;
}

function walk(node, seen) {
    if(typeof node === "string") return repair(node, seen);
    if(Array.isArray(node)) return node.map(value => walk(value, seen));
    if(!node || typeof node !== "object") return node;

    const out = {};
    for(const [key, value] of Object.entries(node)) {
        out[repair_key(key, seen)] = walk(value, seen);
    }
    return out;
}

export function repair_foreign_save(save_data) {
    const seen = new Set();
    const repaired = walk(save_data, seen);
    if(seen.size) console.info(`Loaded a save from an English build, translated ${seen.size} ids back:`, [...seen]);
    return repaired;
}
