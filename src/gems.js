"use strict";

import { character } from "./character.js";
import { item_templates } from "./items.js";

function gem_efficiency(current_value, gem_value, scgv, stat_multiplier = 1) {
    const softcap = gem_value * scgv * stat_multiplier;
    if ((current_value || 0) < softcap) return 1;
    const x = (current_value || 0) / softcap;
    return Math.exp(-5 * (x + 1 - 2 * Math.sqrt(x)));
}

function gem_health_multiplier(gem_value) {
    let multiplier = gem_value > 7500 ? 100 : 50;
    if (gem_value > 7500e4) multiplier *= 2;
    return multiplier;
}

function get_gem_efficiencies(item) {
    const gem_value = item.gem_value;
    const scgv = character.stats.full.SCGV || 1;
    const gems = character.stats.flat.gems ?? {};
    const efficiencies = {
        attack_power: gem_efficiency(gems.attack_power, gem_value, scgv),
    };
    if (!item.getName().includes("剑")) {
        efficiencies.defense = gem_efficiency(gems.defense, gem_value, scgv);
        efficiencies.agility = gem_efficiency(gems.agility, gem_value, scgv);
        efficiencies.max_health = gem_efficiency(
            gems.max_health,
            gem_value,
            scgv,
            gem_health_multiplier(gem_value),
        );
    }
    return efficiencies;
}

function get_average_gem_efficiency(item) {
    const values = Object.values(get_gem_efficiencies(item));
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function get_expected_gem_stats(loot_list, droprate_modifier = 1) {
    let unscaled = 0;
    let scaled = 0;
    for (const drop of loot_list) {
        const item = item_templates[drop.item_name];
        if (!(item?.gem_value > 0)) continue;
        const expected_count = drop.chance * (drop.ignore_luck ? 1 : droprate_modifier);
        const expected_stats = expected_count * item.gem_value;
        unscaled += expected_stats;
        scaled += expected_stats * get_average_gem_efficiency(item);
    }
    return {
        unscaled,
        scaled,
        efficiency: unscaled > 0 ? scaled / unscaled : 0,
    };
}

export { get_gem_efficiencies, get_average_gem_efficiency, get_expected_gem_stats };
