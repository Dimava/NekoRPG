"use strict";

import { traders } from "./traders.js";
import { current_trader, to_buy, to_sell, trade_state } from "./trade.js";
import { skills } from "./skills.js";
import { character, get_hero_xp_gain } from "./character.js";
import { current_enemies, options,
    current_location,
    active_effects,
    get_current_book,
    faved_stances,
    selected_stance,
    global_flags, get_enemy_killcount,
    get_time_passed,family_data,init_family,
    realm_rate, get_baby_cost, PNtIC,
    game_state} from "./main.js";
import { current_game_time } from "./game_time.js";
import { book_stats, item_templates, Weapon, Armor, Shield , rarity_multipliers , getItemRarity , ScaledQualityMultiplier} from "./items.js";
import { REALMS } from "./realms.js";
import { get_location_type_penalty, location_types, locations } from "./locations.js";
import { enemy_killcount, enemy_templates } from "./enemies.js";
import { expo, stat_names, get_hit_chance, round_item_price } from "./misc.js"
import { stances } from "./combat_stances.js";
import { recipes } from "./crafting_recipes.js";
import { effect_templates } from "./active_effects.js";
import { t, number_scale } from "./i18n.js";
import { reactive } from "@vue/reactivity";
import { ui_state } from "./ui_state.js";


//location actions & trade
const action_div = document.getElementById("location_actions_div");
const trade_div = document.getElementById("trade_div");

/** replaced by the TimeAndLocation island (`src/islands/TimeAndLocation.vue`, `data-island="time-and-location"`)
 * const location_name_span = document.getElementById("location_name_span");
 * const location_types_div = document.getElementById("location_types_div");
 * const location_tooltip = document.getElementById("location_name_tooltip");
 */
const location_panel = reactive({ current: null, combat: false, pulse: 0 });

/** what the LocationActions island (`data-island="location-actions"`) shows; the last show_actions call wins */
const action_panel = reactive({
    mode: "location", // location | combat | choices | dialogue | activity | sleeping | reading
    location: null, category: null, add_icons: true, is_combat: false,
    dialogue: null, answer: "", book: null,
    pulse: 0, // dialogues, traders and activities are plain objects, so every show_actions repaints
});

function show_actions(state) {
    Object.assign(action_panel, {location: null, category: null, add_icons: true, is_combat: false, dialogue: null, answer: "", book: null}, state);
    action_panel.pulse++;
}

//inventory display

//message log lives in src/islands/MessageLog.vue

//enemy info lives in src/islands/Combat.vue
const combat_div = document.getElementById("combat_div");




/** replaced by the CharacterStats island (`src/islands/CharacterStats.vue`, `data-island="character-stats"`)
 * const character_level_div = document.getElementById("character_level_div");
 * const active_effects_tooltip = document.getElementById("effects_tooltip");
 * const active_effect_count = document.getElementById("active_effect_count");
 */

/** replaced by the Time island (`src/islands/Time.vue`, `data-island="time"`)
 * const time_field = document.getElementById("time_div");
 */

const skill_panel = reactive({
    shown: {},
    sort_by: "name",
    direction: "asc",
    expanded: {},
});

const stance_panel = reactive({ pulse: 0 });
const levelary_panel = reactive({ shown: {} });
const inventory_panel = reactive({ sort_by: 'price', direction: 'asc', filter: 'all', book_pulse: 0 });






let character_inventory_sorting = "name";
let character_inventory_sorting_direction = "asc";

const message_count = {
    message_combat: 0,
    message_unlocks: 0,
    message_loot: 0,
    message_events: 0,
    message_background: 0,
    message_crafting: 0,
};

/** replaced by the CharacterStats island (`src/islands/CharacterStats.vue`, `data-island="character-stats"`)
 * const stats_divs = {agility: document.getElementById("agility_slot"), ... };
 * let effect_divs = {};
 */



const rarity_colors = {
    trash: "rarity_trash",
    common: "rarity_common",
    uncommon: "rarity_uncommon",
    rare: "rarity_rare",
    epic: "rarity_epic",
    legendary: "rarity_legendary",
    mythical: "rarity_mythical",
    transdental: "rarity_transdental",
    celestial: "rarity_celestial",
    antique: "rarity_antique",
    flawless: "rarity_flawless",
}

/** crafting window state for the Crafting island (`data-island="crafting"`); use_recipe reads the picks from here */
const crafting_panel = reactive({
    open: false,
    page: "crafting",
    subpage: {},    // category -> shown subcategory, "items" when unset
    expanded: null, // recipe_key of the unfolded recipe
    lists: {},      // `${recipe_key}/${slot}` -> true while that component list is unfolded
    components: {}, // recipe_key -> [item_key, item_key] picked for an equipment recipe
});

function recipe_key({category, subcategory, recipe_id}) {
    return `${category}/${subcategory}/${recipe_id}`;
}

/**
 * inventory entries usable in one component slot of an equipment recipe, best first:
 * higher tier, then name, then higher quality. use_recipe auto-picks the first one.
 */
function component_candidates(recipe, slot) {
    const by_name = (a, b) => a.item.getName() > b.item.getName() ? 1 : a.item.getName() < b.item.getName() ? -1 : 0;
    return Object.values(character.inventory)
        .filter(entry => entry.item?.component_type === recipe.components[slot])
        .sort((a, b) => (b.item.component_tier - a.item.component_tier) || by_name(a, b) || (b.item.quality - a.item.quality));
}

const other_save_load_button = document.getElementById("import_other_save_button");


function format_number(some_number)
{
    let f_result = "";
    if(some_number<0)
    {
        f_result+='-';
        some_number*=-1;
    }
    if(some_number <= 1e-8) return '0';
    let len=Math.floor(Math.log10(some_number)) + 1;//位数！
    if(some_number<1e-4) f_result += '0';
    if(some_number > 1e53 || (options.option_format_change && some_number > 1e6)){
        len--;//exp
        some_number *= 0.1 ** len;
        f_result += some_number.toFixed(2);
        f_result += 'e';
        f_result += Math.round(len);
        return f_result;
    }
    else if(number_scale().group == 3)
    {
        f_result += format_scaled(some_number, len, number_scale());
    }
    else if(len<=4||len==6)
    {
        f_result += String(some_number).substring(0,6);
    }
    else if(len==5)
    {
        f_result += String(some_number).substring(0,5);
    }
    else
    {
        let unitid = Math.floor((len-2)/4);
        f_result += String(some_number/(Math.pow(10000,unitid))).substring(0,((len - unitid*4==5)?5:6));
        f_result += number_scale().units[unitid];
    }
    return f_result;
}

//KMBT groups by a thousand, so it needs its own split: four significant digits
//and no trailing zeros. Raw digits run up to 99999, so K starts at 100000.
function format_scaled(some_number, len, scale) {
    if(len <= 5) return String(some_number).substring(0, 6);
    const unitid = Math.min(Math.floor((len - 1) / scale.group), scale.units.length - 1);
    const mantissa = some_number / Math.pow(10, unitid * scale.group);
    return String(Number(mantissa.toFixed(3))) + scale.units[unitid];
}

function capitalize_first_letter(some_string) {
    return some_string.charAt(0).toUpperCase() + some_string.slice(1);
}

function clear_skill_bars() {
    skill_panel.shown = {};
}



/**
 * @param {Item} item
 * @param {Object} options
 * @param {String} options.class_name
 * @param {Boolean} options.skip_quality
 * @param {Array} options.quality array with 1 or 2 values (1 - show only it, instead of item's; 2 - show start comparison between the two)
 */
function create_item_tooltip(item, options) {
    let item_tooltip = document.createElement("span");
    item_tooltip.classList.add(options?.class_name || "item_tooltip");
    item_tooltip.innerHTML = create_item_tooltip_content({item, options});
    return item_tooltip;
}

/**
 * @param {Object} params
 * @param {Item} params.item
 * @param {Object} params.options
 * @param {String} params.options.class_name
 * @param {Boolean} params.options.skip_quality
 * @param {Array} params.options.quality array with 1 or 2 values (1 - show only it, instead of item's; 2 - show start comparison between the two)
 */
function create_item_tooltip_content({item, options={}}) {
    const item_title = typeof item.getNameParts === "function"
        ? item.getNameParts().map(part => t(part)).join(" ")
        : t(item.getName());
    let item_tooltip = `<b>${item_title}</b>`;
    if(item.description) {
        item_tooltip += `<br>${t(item.getDescription())}`;
    }

    let quality = item.quality;
    if(options?.quality && options.quality) {
        quality = options.quality;
    }

    //add stats if can be equipped
    if(item.item_type === "EQUIPPABLE"){ 
        if(options?.quality && options.quality[0]) {
            quality = options.quality[0];
        }
        if(item.equip_slot != "props" && item.equip_slot != "method" && item.equip_slot != "special" && item.equip_slot != "realm")//disable quality
        {
            if(!options.skip_quality && options?.quality?.length == 2) {
                item_tooltip += t`<br><br><b>品质: <span class="${rarity_colors[item.getRarity(options.quality[0])]}"> ${options.quality[0]}% </span> - <span class="${rarity_colors[item.getRarity(options.quality[1])]}"> ${options.quality[1]}% </span></b>`;
            } else {
                item_tooltip += t`<br><br><b><span class="${rarity_colors[item.getRarity(quality)]}">品质: ${quality}% </span></b>`;
            }
        }
        let SkillLevelMap = {"Mining":"挖掘","Woodcutting":"砍伐","Fishing":"钓鱼"};
        if(item.bonus_skill_levels != {})
        {
            let S_levels = item.bonus_skill_levels;
            item_tooltip += `<br>`;
            item_tooltip += `<br>`;
            Object.keys(S_levels).forEach(S_name => {
                        
                        if(S_levels[S_name] > 0) {
                            item_tooltip += `${SkillLevelMap[S_name]}: +${S_levels[S_name]}<br>`
                        }

            });
        }

        let EquipSlotMap = {"sword":"剑","head":"头部","trident":"三叉戟","moonwheel":"月轮","torso":"躯干","legs":"腿部","feet":"脚部","pickaxe":"镐子","axe":"斧子","sickle":"镰刀","props":"道具","method":"秘法","special":"特殊","realm":"领域"}
        if(item.equip_slot === "weapon") {
            item_tooltip += t`<br>类型: <b>${EquipSlotMap[item.weapon_type]}</b>`;
        }
        else if(item.offhand_type !== "shield") {
            item_tooltip += t`<br>槽位: <b>${EquipSlotMap[item.equip_slot]}</b>`;
        }

        if(item.components) {
            let component_description = `<br><br><span class="item_component_list">`;
            const components = Object.keys(item.components);

            if(item.components) {
                component_description += `[${t(item_templates[item.components[components[0]]].getName())}]`;
                if(!item.components[components[1]]) {
                    component_description += `+ ${t("无")} [${t(components[1])}]`;
                } else {
                    component_description += `+[${t(item_templates[item.components[components[1]]].getName())}]`;
                }
            }

            component_description += `</span>`;
            item_tooltip += component_description;
        }

        
        let EquipStatMap = {"Defense":"防御","Attack power":"攻击","Attack speed":"攻速","Agility":"敏捷","Crit rate":"暴率","Max health":"生命","Attack mul":"普攻倍率","Crit multiplier":"爆伤","Health regeneration_flat":"生命恢复","Health regeneration_percent":"生命恢复[%]","Luck":"幸运","SCGV":"宝石耐性"}
        if(!options.skip_quality && options?.quality?.length == 2) {
            if(item.getAttack) {
                item_tooltip += 
                    t`<br><br>攻击: ${format_number(item.getAttack(options.quality[0]))}-${format_number(item.getAttack(options.quality[1]))}`;
            } else if(item.getDefense) { 
                item_tooltip += 
                t`<br><br>防御: ${format_number(item.getDefense(options.quality[0]))}-${format_number(item.getDefense(options.quality[1]))}`;
            } else if(item.offhand_type === "shield") {
                item_tooltip += 
                `<br><br>Can block up to: ${Math.round(10*item.getShieldStrength(options.quality[0])*(character.stats.total_multiplier.block_strength))/10}-${Math.round(10*item.getShieldStrength(options.quality[1])*(character.stats.total_multiplier.block_strength))/10} damage [base: ${item.getShieldStrength(options.quality[0])}-${item.getShieldStrength(options.quality[1])}]`;
            }

            const equip_stats_0 = item.getStats(options.quality[0]);
            const equip_stats_1 = item.getStats(options.quality[1]);
            if(Object.keys(equip_stats_0).length > 0) {
                item_tooltip += `<br>`;
            }
            Object.keys(equip_stats_0).forEach(effect_key => {

                if(equip_stats_0[effect_key].flat != null) {
                    item_tooltip += 
                    t`<br>${EquipStatMap[capitalize_first_letter(effect_key).replace("_"," ")]}: +${format_number(equip_stats_0[effect_key].flat)}-${format_number(equip_stats_1[effect_key].flat)}`;
                }
                if(equip_stats_0[effect_key].multiplier != null) {
                    item_tooltip += 
                    t`<br>${EquipStatMap[capitalize_first_letter(effect_key).replace("_"," ")]}: x${format_number(equip_stats_0[effect_key].multiplier)}-${format_number(equip_stats_1[effect_key].multiplier)}`;
            }
            });
        } else {
            if(item.getAttack) {
                item_tooltip += 
                    t`<br><br>攻击: ${format_number(item.getAttack())}`;
            } else if(item.getDefense && item.equip_slot != "props" && item.equip_slot != "method" && item.equip_slot != "special" && item.equip_slot != "realm") { 
                item_tooltip += 
                t`<br><br>防御: ${format_number(item.getDefense())}`;
            } else if(item.offhand_type === "shield") {
                item_tooltip += 
                `<br><br>Can block up to: ${Math.round(10*item.getShieldStrength()*(character.stats.total_multiplier.block_strength))/10} damage [base: ${item.getShieldStrength()}]`;
            }

            const equip_stats = item.getStats();
            if(Object.keys(equip_stats).length > 0) {
                item_tooltip += `<br>`;
            }
            Object.keys(equip_stats).forEach(function(effect_key) {

                if(equip_stats[effect_key].flat != null) {
                    item_tooltip += 
                    t`<br>${EquipStatMap[capitalize_first_letter(effect_key).replace("_"," ")]}: ${equip_stats[effect_key].flat>0?"+":""}${format_number(equip_stats[effect_key].flat)}`;
                }
                if(equip_stats[effect_key].multiplier != null) {
                    item_tooltip += 
                    t`<br>${EquipStatMap[capitalize_first_letter(effect_key).replace("_"," ")]}: x${format_number(equip_stats[effect_key].multiplier)}`;
            }
            });
        }
        item_tooltip += "<br>";
    } 
    else if (item.item_type === "USABLE") {
        item_tooltip += `<br>`;
        if(item.realmcap != -1){
            item_tooltip += t`<br>限制境界: <span class=realm_${REALMS[item.realmcap][5]}>${REALMS[item.realmcap][1]}</span> 及以下<br>`
        }

        if(item.effects.length > 0) {
            item_tooltip += `<br>${t("效果")}: `
        }
        for(let i = 0; i < item.effects.length; i++) {
            item_tooltip += create_effect_tooltip(item.effects[i].effect, item.effects[i].duration).outerHTML;
        }
    } else if(item.item_type === "BOOK") {
        if(!book_stats[item.name].is_finished) {
            item_tooltip += `<br><br>Time to read: ${item.getRemainingTime()} minutes`;
        }
        else {
            item_tooltip += `<br><br>Reading it provided ${character.name} with:<br> ${format_rewards(book_stats[item.name].rewards)}`;
        }
        item_tooltip += "<br>";
    }
    else if(item.tags.component) {
        if(options?.quality && options.quality[0]) {
            quality = options.quality[0];
        }

        if(!options.skip_quality && options?.quality?.length == 2) {
            item_tooltip += t`<br><br><b>品质: <span class="${rarity_colors[item.getRarity(options.quality[0])]}"> ${options.quality[0]}% </span> - <span class="${rarity_colors[item.getRarity(options.quality[1])]}"> ${options.quality[1]}% </span></b>`;
        } else {
            item_tooltip += t`<br><br><b class="${rarity_colors[item.getRarity(quality)]}">品质: ${quality}% </b>`;
        }
        if(item.component_tier) {
            item_tooltip += t`<br>部件等级: ${item.component_tier}`;
        }
        if(options?.quality?.length == 2){
            if(Object.keys(item.stats).length > 0 || item?.attack_value !== 0 || item?.attack_multiplier !== 1) {
                item_tooltip += t`<br>基础属性: `;
            }
            if(item?.attack_value) {
                item_tooltip += t`<br>攻击力: + ${format_number(item.attack_value)}`;
            }
            if(item?.defense_value) {
                item_tooltip += t`<br>防御力: + ${format_number(item.defense_value)}`;
            }
        }
        else{
            if(Object.keys(item.stats).length > 0 || item?.attack_value !== 0 || item?.attack_multiplier !== 1) {
                item_tooltip += t`<br>预期属性: `;
            }
            if(item?.attack_value) {
                item_tooltip += t`<br>攻击力: + ${format_number(item.attack_value * ScaledQualityMultiplier(quality)) }`;
            }
            if(item?.defense_value) {
                item_tooltip += t`<br>防御力: + ${format_number(item.defense_value * ScaledQualityMultiplier(quality))}`;
            }
        }
        let rarity_mul = rarity_multipliers[getItemRarity(quality)];
        if(options?.quality?.length == 2) rarity_mul = 1;
        if(item?.attack_multiplier && item.attack_multiplier !== 1) {
            item_tooltip += `<br>Size-specific attack power: x${item.attack_multiplier}`;
        }
        
        Object.keys(item.stats).forEach(function(effect_key) {

            if(item.stats[effect_key].flat != null) {
                item_tooltip += 
                t`<br>${stat_names[effect_key]}: ${item.stats[effect_key].flat>0?"+":""}${format_number(item.stats[effect_key].flat*(item.stats[effect_key].flat>0?rarity_mul:1))}`;
            }
            if(item.stats[effect_key].multiplier != null) {
                if(item.stats[effect_key].multiplier >= 1) item_tooltip += 
                t`<br>${stat_names[effect_key]}: x${item.stats[effect_key].multiplier + (item.stats[effect_key].multiplier-1) * (rarity_mul - 1)}`;
                else item_tooltip += 
                t`<br>${stat_names[effect_key]}: x${item.stats[effect_key].multiplier}`;
            }
        });
        item_tooltip += "<br>";
    } else {
        item_tooltip += "<br>";
    }

    item_tooltip += t`<br>价值: ${format_money(round_item_price(item.getValue(quality) * ((options && options.trader) ? traders[current_trader].getProfitMargin() : 1) || 0))}`;

    // if(item.saturates_market) {
    //     item_tooltip += ` [初始 ${format_money(round_item_price(item.getBaseValue(quality) * ((options && options.trader) ? traders[current_trader].getProfitMargin() : 1) || 1))}]`
    // }

    return item_tooltip;
}

const effect_stat_names = {"attack_power":"攻击","defense":"防御","agility":"敏捷","crit_multiplier":"爆伤","attack_mul":"普攻倍率","health_regeneration_flat":"生命恢复","health_regeneration_percent":"生命恢复[%]","crit_rate":"暴率","attack_speed":"攻速","max_health":"生命上限","luck":"幸运","SCGV":"宝石耐性"};

/**
 * @returns {{name: String, stats: {name: String, value: String}[]}} untranslated, callers translate at render
 */
function describe_effect(effect_name) {
    const effect = effect_templates[effect_name];

    //for regeneration bonuses, it is assumed they are only flat and not multiplicative
    const stats = Object.entries(effect.effects.stats).map(([key, stat_value]) => ({
        name: effect_stat_names[key],
        value: stat_value.flat == undefined
            ? `x${stat_value.multiplier}`
            : `${stat_value.flat > 0 ? "+" : ""}${format_number(stat_value.flat)}`,
    }));

    return {name: effect.name, stats};
}

/** 
 * @param {Object} item_effect from item effects[]
 */
function create_effect_tooltip(effect_name, duration) {
    const effect = describe_effect(effect_name);
    const tooltip = document.createElement("div");
    tooltip.classList.add("active_effect_tooltip");

    const name_span = document.createElement("span");
    name_span.classList.add("active_effect_name"); 
    name_span.innerHTML = t`'${t(effect.name)}' : `;
    const duration_span = document.createElement("span");
    duration_span.classList.add("active_effect_duration");
    duration_span.innerHTML = duration + "s" ;
    const top_div = document.createElement("div");
    top_div.classList.add("active_effect_name_and_duration");
    top_div.appendChild(name_span);
    top_div.appendChild(duration_span);
    tooltip.appendChild(top_div);

    for(const stat of effect.stats) {
        tooltip.innerHTML += `<br> ${t(stat.name)} : ${stat.value}`;
    }
    return tooltip;
}



/**
 * writes message to the message log
 * @param {String} message_to_add text to display
 * @param {String} message_type used for adding proper class to html element
 */
const messages = reactive([]);
let message_id = 0;
const message_caps = {
    message_combat: 80,
    message_loot: 20,
    message_unlocks: 40,
    message_events: 20,
    message_background: 20,
    message_crafting: 20,
};

function log_message(message_to_add, message_type) {
    if(typeof message_to_add === 'undefined') {
        return;
    }
    message_to_add = t(message_to_add);

    let class_to_add = "message_default";
    let group_to_add = "message_events";

    //selects proper class to add based on argument
    switch(message_type) {
        case "enemy_defeated":
            class_to_add = "message_victory";
            group_to_add = "message_combat";
            message_count.message_combat += 1;
            break;
        case "hero_defeat":
            class_to_add = "message_hero_defeated";
            group_to_add = "message_combat";
            message_count.message_combat += 1;
            break;
        case "enemy_attacked":
            class_to_add = "message_enemy_attacked";
            group_to_add = "message_combat";
            message_count.message_combat += 1;
            break;
        case "enemy_enhanced":
            class_to_add = "message_enemy_enhanced";
            group_to_add = "message_combat";
            message_count.message_combat += 1;
            break;
        case "sayuki":
            class_to_add = "message_sayuki";
            group_to_add = "message_unlocks";
            message_count.message_unlocks += 1;
            break;
        case "enemy_attacked_critically":
            class_to_add = "message_enemy_attacked_critically";
            group_to_add = "message_combat";
            message_count.message_combat += 1;
            break;
        case "hero_attacked":
            class_to_add = "message_hero_attacked";
            group_to_add = "message_combat";
            message_count.message_combat += 1;
            break;
        case "hero_missed":
            group_to_add = "message_combat";
            message_count.message_combat += 1;
            break;
        case "hero_blocked":
            group_to_add = "message_combat";
            message_count.message_combat += 1;
            break;
        case "enemy_missed":
            group_to_add = "message_combat";
            message_count.message_combat += 1;
            break;
        case "hero_regened":
            class_to_add = "message_hero_regened";
            group_to_add = "message_combat";
            message_count.message_combat += 1;
            break;
        case "hero_attacked_critically":
            class_to_add = "message_hero_attacked_critically";
            group_to_add = "message_combat";
            message_count.message_combat += 1;
            break;
        case "spec_hint":
            class_to_add = "spec_hint";
            group_to_add = "message_combat";
            message_count.message_combat += 1;
            break;
        case "combat_loot":
            class_to_add = "message_items_obtained";
            group_to_add = "message_loot";
            message_count.message_loot += 1;
            break;
        case "gathered_loot":
            class_to_add = "message_items_obtained";
            group_to_add = "message_loot";
            message_count.message_loot += 1;
            break;
        case "location_reward":
            group_to_add = "message_loot";
            message_count.message_loot += 1;
            break;

        case "skill_raised":
            class_to_add = "message_skill_leveled_up";
            group_to_add = "message_unlocks";
            message_count.message_unlocks += 1;
            break;
        case "level_up":
            group_to_add = "message_unlocks";
            message_count.message_unlocks += 1;
            break;
        case "activity_unlocked":
            //currently uses default style class
            group_to_add = "message_unlocks";
            message_count.message_unlocks += 1;
            break;
        case "location_unlocked":
            class_to_add = "message_location_unlocked";
            group_to_add = "message_unlocks";
            message_count.message_unlocks += 1;
            break;
        case "dialogue_unlocked":
            group_to_add = "message_unlocks";
            message_count.message_unlocks += 1;
            break;

        case "message_travel":
            class_to_add = "message_travel";
            group_to_add = "message_events";
            message_count.message_events += 1;
            break;
        case "activity_finished":
            group_to_add = "message_events";
            message_count.message_events += 1;
            break;
        case "activity_money":
            group_to_add = "message_events";
            message_count.message_events += 1;
            break;
        case "notification":
            message_count.message_events += 1;
            group_to_add = "message_events";
            class_to_add = "message_notification";
            break;
        case "background":
            message_count.message_background +=1;
            group_to_add = "message_background";
            break;
        case "crafting":
            message_count.message_crafting +=1;
            group_to_add = "message_crafting";
            break;
        case "message_critical":
            message_count.message_events += 1;
            group_to_add = "message_events";
            class_to_add = "message_critical";
            break;
    }

    if(message_caps[group_to_add] && message_count[group_to_add] > message_caps[group_to_add]) {
        const i = messages.findIndex(m => m.group === group_to_add);
        if(i !== -1) messages.splice(i, 1);
    }

    messages.push({
        id: ++message_id,
        text: message_to_add,
        style: class_to_add,
        group: group_to_add,
        filter: group_to_add.slice("message_".length),
    });
}

window.log_message = log_message;

function format_rewards(rewards) {
    let formatted = '';
    if(rewards.stats) {
        const stats = Object.keys(rewards.stats);

        formatted = `+${rewards.stats[stats[0]]} ${stat_names[stats[0]]}`;
        for(let i = 1; i < stats.length; i++) {
            formatted += `, +${rewards.stats[stats[i]]} ${stat_names[stats[i]]}`;
        }
    }

    if(rewards.multipliers) {
        const multipliers = Object.keys(rewards.multipliers);
        if(formatted) {
            formatted += `, x${rewards.multipliers[multipliers[0]]} ${stat_names[multipliers[0]]}`;
        } else {
            formatted = `x${rewards.multipliers[multipliers[0]]} ${stat_names[multipliers[0]]}`;
        }
        for(let i = 1; i < multipliers.length; i++) {
            formatted += `, x${rewards.multipliers[multipliers[i]]} ${stat_names[multipliers[i]]}`;
        }
    }
    if(rewards.xp_multipliers) {
        const xp_multipliers = Object.keys(rewards.xp_multipliers);
        let name;

        const MulNameMapR = {"all":"全部","hero":"等级","all skill":"技能"};
        if(xp_multipliers[0] !== "all" && xp_multipliers[0] !== "hero" && xp_multipliers[0] !== "all_skill") {
            name = skills[xp_multipliers[0]].name();
        } else {
            name = MulNameMapR[xp_multipliers[0].replace("_"," ")];
        }

        if(formatted) {
            formatted += t`, x${rewards.xp_multipliers[xp_multipliers[0]]} ${name} 经验获取`;
        } else {
            formatted = t`x${rewards.xp_multipliers[xp_multipliers[0]]} ${name} 经验获取`;
        }
        for(let i = 1; i < xp_multipliers.length; i++) {
            let name;
            if(xp_multipliers[i] !== "all" && xp_multipliers[i] !== "hero" && xp_multipliers[i] !== "all_skill") {
                name = skills[xp_multipliers[i]].name();
            } else {
                name = MulNameMapR[xp_multipliers[i].replace("_"," ")];
            }
            formatted += t`, x${rewards.xp_multipliers[xp_multipliers[i]]} ${name} 经验获取`;
        }
    }
    return formatted;
}

function clear_message_log() {
    messages.splice(0);
}

/**
 * @param {Array} loot_list [{item, count},...] 
 */
function log_loot(loot_list, is_combat=true) {
    
    if(loot_list.length == 0) {
        return;
    }
    
    let message = is_combat
        ? t`掉落 "${loot_list[0]["item"]["name"]}" x${loot_list[0]["count"]}`
        : t`获取 "${loot_list[0]["item"]["name"]}" x${loot_list[0]["count"]}`;
    if(loot_list.length > 1) {
        for(let i = 1; i < loot_list.length; i++) {
            message += t`, "${loot_list[i]["item"]["name"]}" x${loot_list[i]["count"]}`;
        }
    }

    log_message(message, `${is_combat?"combat_loot":"gathered_loot"}`);
}



function update_displayed_trader() {
    action_div.style.display = "none";
    trade_state.pulse++;
}

/** replaced by the Inventory island (`src/islands/Inventory.vue`, `data-island="inventory"`) */
function update_displayed_money() {}



/** sorting lives in the Inventory and Trade islands; this only updates their state */
function sort_displayed_inventory({sort_by = "name", target = "character", change_direction = false}) {
    const panel = target === "trader" ? trade_state : inventory_panel;
    const dir = target === "trader" ? "sort_dir" : "direction";
    if(target !== "trader" && target !== "character") {
        console.warn(`Something went wrong, no such inventory as '${target}'`);
        return;
    }
    if(change_direction){
        if(sort_by && sort_by === panel.sort_by) {
            panel[dir] = panel[dir] === "asc" ? "desc" : "asc";
        } else {
            panel[dir] = sort_by === "name" ? "desc" : "asc";
        }
    }
    panel.sort_by = sort_by || "name";
}

/** replaced by the Trade island (`src/islands/Trade.vue`, `data-island="trade"`) */
function update_displayed_trader_inventory() {
    trade_state.pulse++;
}

/**
 * updates displayed inventory of the character (only inventory, worn equipment is managed by separate method)
 * 
 * if item_name is passed, it will instead only update the display of that one item
 * 
 * currently item_key is only used for books
 */
/** replaced by the Inventory island (`src/islands/Inventory.vue`, `data-island="inventory"`) */
function update_displayed_character_inventory() {}



/**
 * updates the displayed worn items + attaches tooltips
 */
// update_displayed_equipment: replaced by src/islands/Equipment.vue and Tools.vue

/** replaced by the Inventory island (`src/islands/Inventory.vue`, `data-island="inventory"`) */
function update_displayed_book() {
    inventory_panel.book_pulse++;
}

/** replaced by the Combat island (`src/islands/Combat.vue`, `data-island="combat"`)
 * update_displayed_enemies / update_displayed_health_of_enemies painted #enemies_div
 */
function update_displayed_enemies() {}
function update_displayed_health_of_enemies() {}


function update_displayed_normal_location(location) {
    show_actions({mode: "location", location});
    location_panel.current = location;
    location_panel.combat = false;
    location_panel.pulse++;
    combat_div.style.display = "none";
    document.documentElement.style.setProperty('--actions_div_height', getComputedStyle(document.body).getPropertyValue('--actions_div_height_default'));
    document.documentElement.style.setProperty('--actions_div_top', getComputedStyle(document.body).getPropertyValue('--actions_div_top_default'));
    ui_state.inventoryTab = 'inventory';
}

function update_displayed_location_choices({location_name, category, add_icons = true, is_combat = false}) {
    show_actions({mode: "choices", location: locations[location_name], category, add_icons, is_combat});
}

function update_displayed_combat_location(location, disable_switch = false) {
    show_actions({mode: "combat", location});
    location_panel.combat = true;
    combat_div.style.display = "block";
    document.documentElement.style.setProperty('--actions_div_height', getComputedStyle(document.body).getPropertyValue('--actions_div_height_combat'));
    document.documentElement.style.setProperty('--actions_div_top', getComputedStyle(document.body).getPropertyValue('--actions_div_top_combat'));
    if(!options.disable_combat_autoswitch && !disable_switch) {
        ui_state.inventoryTab = 'combat';
    }
    create_location_types_display(current_location);
}

function create_location_types_display(current_location){
    location_panel.current = current_location;
    location_panel.pulse++;
    /** types paint moved to TimeAndLocation.vue */
    if(current_location.name.includes("鲜血峰 - ")){
        const key_id1 = item_templates["血峰限制器"].getInventoryKey();
        let key_cnt1 = character.inventory[key_id1]?character.inventory[key_id1].count:0;
        key_cnt1 = Math.min(key_cnt1,5);
        if(key_cnt1 != 0){
            log_message(t`[${key_cnt1}x限制器]本区光环已被降低${key_cnt1*20}%!`,"hero_regened");
        }
        const key_id2 = item_templates["血峰增幅器"].getInventoryKey();
        let key_cnt2 = character.inventory[key_id2]?character.inventory[key_id2].count:0;
        key_cnt2 = Math.min(key_cnt2,999025);
        if(key_cnt2 != 0){
            log_message(t`[${key_cnt2}x增幅器]本区光环已被增幅${format_numberL(0.2*(key_cnt2**0.5))}!`,"enemy_enhanced");
        }
    }
}

function update_displayed_location_types(current_location){
    /** replaced by the TimeAndLocation island
     * location_types_div.innerHTML = "";
     */
    create_location_types_display(current_location);
}

function open_crafting_window() {
    action_div.style.display = "none";
    document.getElementById("crafting_window").style.display = "grid";
    Object.assign(crafting_panel, {open: true, page: "crafting", subpage: {}, expanded: null, lists: {}});
}

function close_crafting_window() {
    crafting_panel.open = false;
    action_div.style.display = "block";
    document.getElementById("crafting_window").style.display = "none";
    update_displayed_normal_location(current_location);
}

/**
 * switches between main pages of crafting menu (crafting, alchemy, cooking, etc)
 * @param {String} category
 */
function switch_crafting_recipes_page(category) {
    Object.assign(crafting_panel, {page: category, expanded: null, lists: {}});
}

/**
 * switches between subpages of a crafting page (items-components-equipment)
 * @param {String} category
 * @param {String} subcategory
 */
function switch_crafting_recipes_subpage(category, subcategory) {
    crafting_panel.subpage[category] = subcategory;
    Object.assign(crafting_panel, {expanded: null, lists: {}});
}



















function create_recipe_tooltip_content({category, subcategory, recipe_id, material, components}) {
    const recipe = recipes[category][subcategory][recipe_id];
    const station_tier = current_location?.crafting?.tiers[category] || 0;
    let tooltip = "";
    if(subcategory.includes("items")) {
        const success_chance = Math.round(100*recipe.get_success_chance(station_tier));
        tooltip += t`配方等级：${recipe.recipe_level[1]}<br>`
        tooltip += `${t("成功率:")} <b><span style="color:${success_chance > 74?"lime":success_chance>49?"yellow":success_chance>24?"orange":"red"}">${success_chance}%</span></b><br><br>${t("材料:")}<br>`;
        for(let i = 0; i < recipe.materials.length; i++) {
            const key = item_templates[recipe.materials[i].material_id].getInventoryKey();
            if(character.inventory[key]?.count >= recipe.materials[i].count) {
                tooltip += `<span style="color:lime"><b>${item_templates[recipe.materials[i].material_id].getDisplayName()} x${character.inventory[key]?.count || 0}/${recipe.materials[i].count}</b></span><br>`;
            } else {
                tooltip += `<span style="color:red"><b>${item_templates[recipe.materials[i].material_id].getDisplayName()} x${character.inventory[key]?.count || 0}/${recipe.materials[i].count}</b></span><br>`;
            }
        }
        //console.log(recipe.Q_able);
        if(recipe.Q_able > 0) tooltip += `<br>${t("产物:")}<br><div class="recipe_result">${create_item_tooltip_content({item: item_templates[recipe.getResult().result_id], options: {quality:recipe.Q_able,skip_quality:false}})}</div>`;
        else tooltip += `<br>${t("产物:")}<br><div class="recipe_result">${create_item_tooltip_content({item: item_templates[recipe.getResult().result_id], options: {skip_quality: true}})}</div>`;

    } else if(subcategory === "components"  || recipe.recipe_type === "component") {
        tooltip += t`材料:<br>`;
        if(character.inventory[item_templates[material.material_id].getInventoryKey()]?.count >= material.count) {
            tooltip += `<span style="color:lime"><b>${item_templates[material.material_id].getDisplayName()} x${character.inventory[item_templates[material.material_id].getInventoryKey()]?.count || 0}/${material.count}</b></span><br>`;
        } else {
            tooltip += `<span style="color:red"><b>${item_templates[material.material_id].getDisplayName()} x${character.inventory[item_templates[material.material_id].getInventoryKey()]?.count || 0}/${material.count}</b></span><br>`;
        }
        const quality_range = recipe.get_quality_range(station_tier - item_templates[material.result_id].component_tier);
        tooltip += `<br>${t("产物:")}<br><div class="recipe_result">${create_item_tooltip_content({item:item_templates[material.result_id], options: {quality: quality_range}})}</div>`;
    } else if(subcategory === "equipment") {
        if(!components) {
            //it's a componentless equipment recipe, most probably a clothing
            if(character.inventory[material.material_id]?.count >= material.count) {
                tooltip += `<span style="color:lime"><b>${item_templates[material.material_id].getDisplayName()} x${character.inventory[material.material_id]?.count || 0}/${material.count}</b></span><br>`;
            } else {
                tooltip += `<span style="color:red"><b>${item_templates[material.material_id].getDisplayName()} x${character.inventory[material.material_id]?.count || 0}/${material.count}</b></span><br>`;
            }
            const quality_range = recipe.get_quality_range(station_tier - item_templates[material.result_id].component_tier);
            tooltip += `<br>${t("产物:")}<br><div class="recipe_result">${create_item_tooltip_content({item:item_templates[material.result_id], options: {quality: quality_range}})}</div>`;
        } else if(components.length < 2) {
            tooltip += `${t("产物:")}<br><div class="recipe_result">${t("请在每一类中选择一个部件")}</div>`;
        } else if(components.length == 2) {
            let item = "";
            
            if(recipe.item_type === "Weapon") {
                item = new Weapon(
                    {
                        components: {
                            head: components[0].item.id,
                            handle: components[1].item.id,
                        },
                    }
                );
            } else if(recipe.item_type === "Armor") {
                item = new Armor(
                    {
                        components: {
                            internal: components[0].item.id,
                            external: components[1].item.id,
                        },
                    }
                );
            } else if(recipe.item_type === "Shield") {
                item = new Shield(
                    {
                        components: {
                            shield_base: components[0].item.id,
                            handle: components[1].item.id,
                        },
                    }
                );
            } else {
                throw new Error(`Recipe "${category}" -> "${subcategory}" -> "${recipe_id}" has an incorrect item type "${recipe.item_type}"`)
            }

            const quality_range = recipe.get_quality_range(recipe.get_component_quality_weighted(components[0].item, components[1].item), (station_tier-Math.max(components[0].item.component_tier, components[1].item.component_tier)) || 0);
            tooltip += `${t("产物:")}<br><div class="recipe_result">${create_item_tooltip_content({item, options: {quality: quality_range}})}</div>`;
        } else {
            throw new Error(`Somehow recipe "${category}" -> "${subcategory}" -> "${recipe_id}" received more components than there should be (${components.length} instead of 2)`)
        }
    } else {
        console.error(`No such crafting subcategory as "${subcategory}"`);
    }

    return tooltip;
}











// update_displayed_health, update_displayed_stats and update_displayed_character_xp were replaced by
// the BasicInfo island (`src/islands/BasicInfo.vue`, `data-island="basic-info"`). `character` and
// `active_effects` are reactive, so the HP bar, XP bar and rank recompute on their own.

function get_character_power(){
    let proto_rank = character.stats.full.attack_power + character.stats.full.defense + character.stats.full.agility;
    proto_rank *= ((character.stats.full.attack_mul || 1) * character.stats.full.attack_speed * (1 + (character.stats.full.crit_multiplier - 1) * character.stats.full.crit_rate)) ** 0.5;
    return proto_rank;
}

function get_power_rank(cur_power){
    const lgrank = Math.log10(cur_power);
    let lgresult = 0;
    if(lgrank < 3.84) lgresult = 14 - 0.11 * lgrank ** 2;
    else if(lgrank < 7.903) lgresult = 15.352 - 0.77 * lgrank;
    else lgresult = 18.352 - 1.3 * lgrank + 0.019 * lgrank ** 2;
    return Math.round(Math.max(1, Math.pow(10, lgresult)));
}

window.get_character_power = get_character_power;
window.get_power_rank = get_power_rank;


function update_displayed_time() {
    /** replaced by the TimeAndLocation island (`src/islands/TimeAndLocation.vue`, `data-island="time-and-location"`
     * if(current_game_time.hour >= 150 || current_game_time.hour < 30) {
     *     time_field.innerText = current_game_time.toString() + '✨';
     * } else {
     *     time_field.innerText = current_game_time.toString() + '☀️';
     * }
     * let cur_moon = current_game_time.moon();
     * let moons="🌑🌒🌓🌔🌕🌖🌗🌘";
     * time_field.innerText += (moons[cur_moon*2]+moons[cur_moon*2+1]);
     */
    /** export-button label replaced by the BottomBar island (`src/islands/BottomBar.vue`, `data-island="bottom-bar"`)
     * save_button.innerHTML = ...
     */
}

//Coin tiers, each worth 1000 of the one below it. The last one is unbounded.
const coin_tiers = [
    {unit: "C", css: "coin_copper"},
    {unit: "X", css: "coin_moneyK"},
    {unit: "Z", css: "coin_moneyM"},
    {unit: "D", css: "coin_moneyB"},
    {unit: "B", css: "coin_moneyT"},
    {unit: "U", css: "coin_moneyQa"},
    {unit: "kU", css: "coin_moneyQa"},
    {unit: "MU", css: "coin_moneyQa"},
    {unit: "Δ", css: "coin_moneySp"},
];

/**
 * Formats money as the largest non-empty coin tier and the one directly below
 * it, so a third coin type never appears: 254Z 395X 345C reads as 254Z 395X.
 * Skipping to a distant tier would only add noise, so 1B 000U 345C is just 1B.
 * @param {Number} num value to be formatted
 */
function format_money(num) {
    const sign = num >= 0 ? "" : "-";
    num = Math.abs(num);
    if(num <= 0) return "0";
    if(num < 100 && (num - Math.floor(num)) > 0.01) {
        return `<span class="coin coin_copper">${num.toFixed(2)}C</span> `;
    }

    const amounts = [];
    let rest = Math.floor(num);
    while(rest > 0 && amounts.length < coin_tiers.length) {
        amounts.push(rest % 1000);
        rest = Math.floor(rest / 1000);
    }
    //The top tier is unbounded, so it keeps whatever did not fit into one.
    if(rest > 0) amounts[amounts.length - 1] += rest * 1000;

    const top = amounts.length - 1;
    let value = "";
    for(let i = top; i >= Math.max(top - 1, 0); i--) {
        if(amounts[i] === 0) continue;
        value += `<span class="coin ${coin_tiers[i].css}">${amounts[i].toLocaleString("en-US")}${coin_tiers[i].unit}</span> `;
    }
    return sign + value;
}


// update_displayed_xp_bonuses was replaced by the DataBox island (`src/islands/DataBox.vue`, `data-island="data-box"`)


function update_displayed_dialogue(dialogue_key) {
    show_actions({mode: "dialogue", dialogue: dialogue_key});
}

function update_displayed_textline_answer(text) {
    action_panel.answer = text;
}

function exit_displayed_trade() {
    action_div.style.display = "";
}

function start_activity_display() {
    show_actions({mode: "activity"});
}

function start_sleeping_display() {
    show_actions({mode: "sleeping"});
}

function start_reading_display(title) {
    show_actions({mode: "reading", book: title});
}

/**
 * replaced by the Skills island (`src/islands/Skills.vue`, `data-island="skills"`)
 */
function create_new_skill_bar(skill) {
    if(skill_panel.shown[skill.skill_id]) {
        console.warn(`Tried to create a skillbar for skill "${skill.skill_id}", but it already has one!`);
        return;
    }
    skill_panel.shown[skill.skill_id] = true;
    sort_displayed_skills({});
}

function update_displayed_skill_bar() {}
function update_displayed_skill_description() {}
function update_displayed_skill_xp_gain() {}
function update_all_displayed_skills_xp_gain() {}

function sort_displayed_skills({sort_by="name", change_direction=false}) {
    if(change_direction){
        if(sort_by && sort_by === skill_panel.sort_by) {
            skill_panel.direction = skill_panel.direction === "asc" ? "desc" : "asc";
        } else {
            skill_panel.direction = sort_by === "level" ? "desc" : "asc";
        }
    }
    skill_panel.sort_by = sort_by === "level" ? "level" : "name";
}


/** replaced by the Stances island (`src/islands/Stances.vue`, `data-island="stances"`)
 * update_displayed_stance_list rebuilt #stance_list; tooltips followed --stance_tooltip_* CSS vars
 */
function update_displayed_stance_list() {
    stance_panel.pulse++;
}
function update_displayed_stance() {}
function update_displayed_faved_stances() {}
function update_stance_tooltip() {}

/** replaced by the Family island (`src/islands/Family.vue`, `data-island="family"`)
 * kept init_family side effects; paint lives in the island
 */
function update_displayed_family() {
    if(global_flags["is_family_enabled"]){
        if(!family_data.unlocked) init_family();
        if(family_data.mem[99].vis) init_family();
    }
}
window.update_displayed_family = update_displayed_family;

function format_mem_change() {}
function update_displayed_family_members() {}







/**
 * creates a new bestiary entry;
 * called when a new enemy is killed (or, you know, loading a save)
 * @param {String} enemy_name 
 */


/* 
Create anything needed about 'special stats' Display
[0]：魔攻

*/

let spec_stat = [[0, '魔攻', '#bbb0ff','这个敌人似乎掌握了魔法。<br>敌人无视角色的防御。'],
[1, "坚固", "#c0b088","这个敌人拥有土元素之力，坚不可摧。<br>单次对敌人的伤害不能超过<span style='color:#87CEFA'>1</span>。"],
[2, "迅捷", "#ffcc33","这个敌人出手快人一步。<br>敌人首先发动一次<span style='color:yellow'>额外攻击</span>。"],
[3, "2连击", "#ffee77", "敌人进攻速度很快，拥有更加恐怖的杀伤力，但同时也意味着生命力会较为脆弱。<br>敌人每回合攻击<span style='color:#87CEFA'>2次</span>。"],
[4, "疾走", "#5dc44b", "这个敌人出手快而敏捷。<br>敌人首先发动一次<span style='color:#87CEFA'>3连击</span>。"],
[5, "牵制", "#25c1d9", "牵制对手的招式可能成为窍门或是负累。<br>敌人每回合伤害*<span style='color:#87CEFA'>（敌人防御力/角色防御力）</span>。"],
[6, "3连击", "#ffee77", "敌人进攻速度很快，拥有更加恐怖的杀伤力，但同时也意味着生命力会较为脆弱。<br>敌人每回合攻击<span style='color:#87CEFA'>3次</span>。"],
[7, "撕裂", "#a52a2a", "这个敌人攻击非常凶猛，造成了撕裂效果。<br>敌人的战斗伤害增加<span style='color:#87CEFA'>一半</span>。"],
[8, "衰弱", "#f2a4e8", function(enemy){return t`用毒魔法弱化对手的能力。<br>与该敌人战斗时，角色的攻防效力削弱<span style='color:#87CEFA'>${enemy.spec_value[8]}%</span>。`}],
[9, "反转", "#FFC0CB", "微妙的战斗领悟，使用诡异的战法，为攻守双方带来全新的策略维度。<br>战斗中，角色<span style='color:yellow'>攻击与防御效力交换</span>。"],
[10, "回风", "#8ED1A6","借助风元素的势进行的二段不对等打击。<br>敌人每回合以<span style='color:#87CEFA'>0.8、1.2倍</span>攻击<span style='color:yellow'>各攻击一次</span>。"],
[11, "光环", "#E6E099","光环异兽的身周总是围着一群异兽，并且个个都看起来很亢奋。(效果整合在楼层属性中)"],
[12, "时封", "#917881","时元素领悟。短暂延缓自身周围区域内时间的流速，为某些关键时刻创造机会。<br>每一回合战斗伤害变为<span style='color:#87CEFA'>回合数</span>倍。"],			
[13, "惑幻", "#B20EB2","制人于幻境中，受到幻境的蛊惑。<br>前<span style='color:#87CEFA'>3回合</span>，以角色攻击各额外攻击一次。"],
[14, "斩阵", "#5269B7","看起来很像虚张声势的剑阵。<br>敌人布下诡秘的杀阵，在战斗进行到第<span style='color:#87CEFA'>二、四、六</span>回合时，分别对角色额外造成<span style='color:#87CEFA'>2倍、3倍、4倍</span>敌人攻击力的伤害。"],
[15, "异界之门", "#808080","时元素领悟。触及了一丝命运规律的领悟，张开的黑暗之门似通向另一个世界。<br>每一回合战斗伤害变为<span style='color:#87CEFA'>2*回合数-1</span>倍。"],
[16, "飓风", "#337d3d","这个敌人迅疾如风，引动了天地间的风元素异象。<br>敌人首先发动4段<span style='color:#87CEFA'>5倍伤害</span>的攻击。"],
[17, "执着", "#cbb2d9","铁杵磨成针。<br>敌人的攻击额外增加角色生命的0.5%。"],
[18, "贪婪", "#dfe650",function(enemy){return t`这个敌人似乎对金钱十分敏感。<br>角色每拥有${format_money(enemy.spec_value[18])},该敌人伤害减少<span style='color:#87CEFA'>1%</span>.`}],
[19, "同调", "#FF6A6A","玄妙且具备威胁的领悟，可以共享属性。<br>敌人会随着角色的变强而变强，其攻防敏附加<span style='color:#87CEFA'>10%</span>角色的攻防。"],
[20, "天剑", "#9B8AFC","可将天地能量汇聚于自身的攻势进行战斗。<br>敌人每回合额外造成自身攻击<span style='color:#87CEFA'>3倍</span>与角色防御<span style='color:#87CEFA'>2倍</span>差值的伤害。"],
[21, "灵体", "#ff9977",function(enemy){return t`以特殊的生命形式而存在。<br>敌人对角色每回合造成<span style='color:#87CEFA'>${enemy.spec_value[21]}与角色敏捷之差的五倍</span>点伤害。<br>此额外伤害下限为0.`}],
[22, "绝世", "#DEF27B","五连绝世。<br>战斗前，敌人以0.9倍的攻击力发动一次<span style='color:#87CEFA'>5连击</span>。"],
[23, "灵闪", "#F2EC41","光元素领悟。以快而强大的进攻压制对手。<br>当<span style='color:#FFFF00'>角色的攻击（计算加成）少于敌人</span>时，敌人受到的伤害比例减少<span style='color:#87CEFA'>（敌人防御/角色防御）的二分之一</span>。"],
[24, "饮剑", "#F0A078","将炽烈的进攻元素吸收并化为自身的能力。<br>敌人的生命增加角色攻击的<span style='color:#87CEFA'>0.5倍</span>。"],
[25, "饮盾", "#3C6794","将刚猛的防守元素吸收并化为自身的能力。<br>敌人的生命增加角色防御的<span style='color:#87CEFA'>0.5倍</span>。"],
[26, "分裂", "#8EA5D1","拥有两种能力的战斗法师。敌人每回合的攻击<span style='color:#87CEFA'>翻倍</span>"],
[27, "柔骨", "#2CBA3A","接下攻击，并化为另一种劲力发回。<br>战斗时，角色的攻击效力转移<span style='color:#87CEFA'>10%</span>到防御上。"],
[28, "肤·免疫", "#808080","别想用它刷坚韧皮肤！"],
[29, "阻击", "#8888e6",function(enemy){return t`这个敌人似乎懂得且战且退的道理。<br>如果敌人闪避了攻击，则额外对角色造成<span style='color:#87CEFA'>${enemy.spec_value[29]}</span>点魔法伤害。`}],
[30, "净化", "#80eed6",function(enemy){return t`战斗前，敌人将角色敏捷的<span style='color:#87CEFA'>${enemy.spec_value[30]}倍</span>加到自己的攻击上。`}],
[31, "回春", "#ccff99","木元素领悟。修习了战复魔法的冒险者钟爱的属性。<br>敌人每次命中恢复自身生命上限<span style='color:#87CEFA'>30%</span>的生命。"],
[32, "反戈", "#d3a547","反戈一击。<br>敌人将角色伤害的<span style='color:#87CEFA'>20%</span>反弹给角色。"],
[33, function(enemy){return t`${enemy.spec_value[33]}连击`}, "#ffee77",function(enemy){return t`敌人进攻速度很快，拥有更加恐怖的杀伤力，但同时也意味着生命力会较为脆弱。<br>敌人每回合攻击<span style='color:#87CEFA'>${enemy.spec_value[33]}次</span>。`}],
[34, "凌弱","#109996","欺凌弱小的敌人容易被防杀。<br>当角色<span style='color:#FFFF00'>防御小于敌人</span>时，其<span style='color:#FFFF00'>与敌人防御的差值</span>将拉大<span style='color:#87CEFA'>一倍</span>。"],
[35, "领域", "#c677dd",function(enemy){return t`这个敌人似乎懂得力量外放的道理。<br>敌人每次被攻击，则额外对角色造成<span style='color:#87CEFA'>${enemy.spec_value[35]}</span>点领域伤害。此伤害可被敏捷1:1减免。`}],
[36, "自爆", "#597a80","强者在绝望之下最后的尊严。<br>第20回合触发，血量下降到1，对角色造成<span style='color:#87CEFA'>自身剩余生命*4</span>的伤害。"],
[37, "散华", "#d08e53","奇妙的能力，感应血气并作用于攻击。<br>角色攻击的效力削弱（敌人生命/角色生命）的<span style='color:#87CEFA'>一倍</span><br>。"],
[38, "冰符咒", "#6699FF", "由传说中的最强妖精创造的符咒，虽然她的生命力并不如何高。<br>在<span style='color:#FFFF00'>第9回合</span>施展冰符咒，额外造成<span style='color:#87CEFA'>20倍攻击力</span>的魔法伤害。"],
[39, "贪婪·宝石", "#50dfe6",function(enemy){return t`这个敌人似乎对宝石十分敏感。<br>角色每在[心之境界-一重]拥有${format_number(enemy.spec_value[39])}价值点<br>,该敌人伤害减少<span style='color:#87CEFA'>1%</span>.`}],
[40, "追光", "#ecff17", "光元素领悟。这个敌人快得恍若一道照亮世界的光。<br>敌人首先发动一次敌人首先发动3段<span style='color:#87CEFA'>50倍伤害</span>的<span style='color:#FFFF00'>必中攻击</span>。"],
[41, "召唤", "#f5deb3", "群居生物同心协力的体现。敌人刷新时，额外刷新3只【紫锈胎人】。"],
[42, "圣阵", "#d9964a", "才德全尽谓之圣人，十圆无缺谓之圣阵。<br>敌人布下圣阵，在战斗进行到第<span style='color:#87CEFA'>五、十、二十</span>回合时，分别对角色造成<span style='color:#87CEFA'>3倍、9倍、27倍</span>角色与敌人攻防之和的穿透伤害。"],
[43, "激光", "#dda0dd",function(enemy){return t`攻击时，无论是否命中，都额外造成<span style='color:#87CEFA'>${enemy.spec_value[43]}</span>点魔法伤害。`}],
[44, "召唤", "#f5deb3", "群居生物同心协力的体现。敌人刷新时，额外刷新3只【舰船除草机B1】。"],
[45, "10回合", "#524fdb","在敌人的手中走过十回合！敌人会在第10回合被镭射枪击中，将<span style='color:#87CEFA'>血量降为1</span>.<br><span style='color:#FF0000'><b>前提是,姐姐被你带在身边.</b></span>"],
[46, "饮剑·改", "#F0A078","将炽烈的进攻元素吸收并化为自身的能力。<br>敌人的生命增加角色攻击的<span style='color:#87CEFA'>2.5倍</span>。"],
[47, "饮盾·改", "#3C6794","将刚猛的防守元素吸收并化为自身的能力。<br>敌人的生命增加角色防御的<span style='color:#87CEFA'>2.5倍</span>。"],
[48, "冰凌剑", "#87CEEB",function(enemy){return t`冰元素领悟。将冰元素变换为剑形态，刺穿对手的术式，唯有灵活的腾挪方可抵挡。<br>战斗前，对角色造成相当于角色攻防和<span style='color:#87CEFA'>20倍</span>的必中伤害。该技能效果可被敏捷减免，每${format_number(enemy.spec_value[48])}点敏捷可减免1%伤害。`}],
[49, "冰封术", "#73E4D4",function(enemy){return t`冰元素领悟。可以让人瞬间变成冰块的术式，唯有蓬勃的生命得以顽强成长。<br>战斗前，对角色进行<span style='color:#87CEFA'>5段${format_number(enemy.spec_value[49].rnd / 5)}倍</span>的先攻。该技能效果可被生命减免，每${enemy.spec_value[49].hp}点生命可免除0.2倍先攻倍率。`}],
[50, "冻伤", "#97C6E8",function(enemy){return t`冰元素领悟。让对手在低温中感受到难以言喻的痛苦，强大的体魄是镇痛的必要条件。<br>战斗前，对角色造成相当于角色敏捷<span style='color:#87CEFA'>40倍</span>的必中伤害。该技能效果可被攻防和减免，每${enemy.spec_value[50]}点攻防和可减免1%伤害。`}],
[51, "压制", "#e3e647", "压制对手的招式可能成为窍门或是负累。<br>敌人每回合伤害*<span style='color:#87CEFA'>（敌人攻防和/角色攻防和）</span>。"],
[52, "压制·伪", "#47e6a4", "压制/牵制对手的招式可能成为窍门或是负累。<br>敌人每回合伤害*<span style='color:#87CEFA'>(敌人攻防和/角色攻防和)^(1-0.01*牵制领悟度)*(敌人防御力/角色防御力)^(0.01*牵制领悟度)</span>。"],
[53, "同调·魔", "#FF6A00","玄妙且具备威胁的领悟，可以共享属性。<br>敌人会随着角色的变强而变强，其攻击附加<span style='color:#87CEFA'>200%</span>角色的攻击。"],
[54, "生命限制", "#ffacc5","限制对手的能力可能成为窍门或是负累。<br>敌人每回合伤害*（敌人生命/角色生命）[PS:上限100倍]。"],
[55, "贪婪·改", "#bfc630",function(enemy){return t`这个敌人似乎对金钱十分敏感。<br>角色每拥有${format_money(enemy.spec_value[55])},该敌人伤害减少<span style='color:#87CEFA'>1%</span>,上限<span style='color:#87CEFA'>80%</span>.`}],
[56, "禁锢", "#808080","敌人死亡时，角色获取一个<span style='color:#87CEFA'>攻速-20%</span>的状态效果，持续<span style='color:#87CEFA'>30s</span>。"],
[57, "滋生", "#ff20c0","敌人死亡时，场上【心之灵·暴走】数量增加3个。"],
[58, "暴走", "#fffc62","敌人死亡时，场上【心之灵·暴走】基础攻击/血量增加5%(叠加)。"],
[59, "心之灵", "#b0f6ff","敌人死亡时，获取1点【灵魂之力】。"],
[60, "败移" , "#32CD32", "空元素领悟。敌人会召唤一只本区敌人为它挡枪(不会循环召唤)"],
[61, "小队" ,"#584af0", "小队成员为了生存而聚集在一起战斗。<br>由2-50个单位组成的小队。"],
[62, "死线" ,"#DCDCDC", "不要忘记那些不得不做的事情。战斗结束后，角色获取<span style='color:#87CEFA'>60s 5倍易伤</span>(会显示在血条上)。"],
[63, "硬化" ,"#94478a", "当角色攻击大于防御时，怪物将<span style='color:#FFFF00'>无视超出部分的攻击数值</span>。"],
[64, "大队" ,"#d532eb", "大队成员气势汹汹，欲杀死所有阻拦自己的敌人。<br>由100-5000个单位组成的大队。"],
[65, "血遁" ,"#a8002d", "燃烧精血获取到的远超同境的移速，精血枯竭时即会原形毕露。<br>敌人有效敏捷上升<span style='color:#FFFF00'>敌人血量百分比的99倍</span>。"],
[66, "吹火掌","#f55882","火、空元素领悟。穹斗世界古书中记载的某种斗技，控制与对手的距离。<br><span style='color:#FFFF00'>敌人命中角色时</span>，将角色下一次攻击冷却<span style='color:#87CEFA'>增加50%</span>(可叠加)"],
[67, "血杀","#f55882","你曾为自己的使命流过多少血？<br>当<span style='color:#FFFF00'>角色生命多于敌人</span>时，敌人伤害<span style='color:#87CEFA'>增加一半</span>，反之<span style='color:#87CEFA'>减少一半</span>。"],
[68, "散华·改", "#d08e53","奇妙的能力，感应血气并作用于攻击。<br>角色攻击的效力削弱（敌人生命/角色生命）的<span style='color:#87CEFA'>10%</span><br>。"],
[69, "反击" , "#B30000", "战斗前，敌人将角色攻击的<span style='color:#87CEFA'>100%</span>加到自己的攻击上"],
[70, "贪婪 ω", "#dfe650",function(enemy){return t`这个敌人似乎对金钱十分敏感。<br>敌人的伤害除以<span style='color:#87CEFA'>(1 + √(角色金钱/${format_money(enemy.spec_value[70])}) )</span>`}],
[71, "神帝之力" , "#B3FFB3", "敌人每次攻击时，赋予角色5秒<span style='color:#FFFF00'>神帝之力</span>效果，不可叠加。如果角色在被击中前不携带该效果，则敌人该次攻击伤害<span style='color:#87CEFA'>归零</span>。<span style='color:#FFFF00'>神帝之力</span>效果为<span style='color:#87CEFA'>攻击/防御/敏捷/生命上限 乘以 100.81/span>.<br><span style='color:#FFFF00'>神帝之力</span>在切换区域时自动消失，且携带此效果时家族新境界无法解禁。"],
[72, "战团" ,"#f527d3", "一个成组织战斗的集体。他们观察敌情，发现敌方境界并不高，而且人数并不多，所以他们开始了战斗。<br>由1万-100万个单位组成的战团。"],

];
//超过25倍倍率的攻击暂时视为必中！
function format_perc(perc){
    if(perc < 10) return format_number(100*perc) + '%';
    else return format_number(perc) + 'x'; 
}

function format_numberL(perc){
    const rounded = value => Number(value.toPrecision(6));
    if(perc < 1e-6) return format_number(rounded(10000*perc)) + '/亿';
    else if(perc < 0.001) return format_number(rounded(10000*perc)) + '‱';
    else if(perc < 10) return format_number(rounded(100*perc)) + '%';
    else return format_number(rounded(perc)) + 'x'; 
}

/** replaced by the Bestiary island (`src/islands/Bestiary.vue`, `data-island="bestiary"`)
 * keep missing-template killcount nulling; paint lives in the island
 */
function create_new_bestiary_entry(enemy_name) {
    const enemy = enemy_templates[enemy_name];
    if(enemy == undefined){
        delete enemy_killcount[enemy_name];
        console.warn("试图创建未定义的敌人 [" + enemy_name + "] 的怪物手册条目");
    }
}
function add_bestiary_tooltip() {}
function clear_bestiary_tooltip() {}
function add_bestiary_lines() {}
function update_bestiary_entry() {}
function clear_bestiary() {}
function add_bestiary_zones() {}
function reload_bestiary() {}



/** replaced by the Levelary island (`src/islands/Levelary.vue`, `data-island="levelary"`)
 * keep shown-set mutation; paint lives in the island
 */
function create_new_levelary_entry(level_name) {
    if(levelary_panel.shown[level_name]) return;
    const level = locations[level_name];
    if(!level || level.rank == 0) return;
    levelary_panel.shown[level_name] = true;
}
function add_levelary_tooltip() {}
function clear_levelary_tooltip() {}
function clear_levelary() {
    for (const name of Object.keys(levelary_panel.shown)) delete levelary_panel.shown[name];
}



function clear_skill_list(){
    skill_panel.shown = {};
}

function update_enemy_attack_bar(enemy_id, num) {
    game_state.enemy_attack_progress[enemy_id] = num;
}


// update_backup_load_button: replaced by src/islands/Options.vue reading game_state.backup_date

function update_other_save_load_button(date_string, is_dev) {
    if(is_dev) {
        other_save_load_button.innerText = `Import save from main version`;
    } else {
        other_save_load_button.innerText = `Import save from dev version`;
    }
    if(date_string !== undefined) {
        other_save_load_button.style["background-image"] = `var(--options_gradient);`;
        other_save_load_button.style["background-color"] = "transparent";
        other_save_load_button.style.color = "white";
        other_save_load_button.style.cursor = "pointer";
        if(date_string) {
            other_save_load_button.innerText += ` [${date_string.replaceAll("_",":")}]`;
        } else {
            other_save_load_button.innerText += ` [unknown date]`;
        }
    } else {
        other_save_load_button.style["background-image"] = "none";
        other_save_load_button.style["background-color"] = "#181818";
        other_save_load_button.style.color = "gray";
        other_save_load_button.style.cursor = "not-allowed";
    }
    
}





export {
    crafting_panel, recipe_key, component_candidates, create_recipe_tooltip_content, create_item_tooltip_content,
    action_panel,
    location_panel,
    update_displayed_trader,
    update_displayed_trader_inventory,
    update_displayed_character_inventory,
    sort_displayed_inventory,
    create_item_tooltip,
    update_displayed_money,
    log_message,
    messages,
    format_number,
    update_displayed_enemies,
    update_displayed_health_of_enemies,
    update_displayed_normal_location,
    update_displayed_combat_location,
    log_loot,
    describe_effect,
    format_rewards,
    capitalize_first_letter,
    format_money,
    update_displayed_time,
    update_displayed_dialogue,
    update_displayed_textline_answer,
    exit_displayed_trade,
    start_activity_display,
    start_sleeping_display,
    create_new_skill_bar, update_displayed_skill_bar, update_displayed_skill_description, 
    update_displayed_skill_xp_gain,
    update_all_displayed_skills_xp_gain,
    clear_skill_bars,
    clear_skill_list,
    clear_message_log,
    update_enemy_attack_bar,
    update_displayed_location_choices,
    create_new_bestiary_entry,
    create_new_levelary_entry,
    start_reading_display,
    sort_displayed_skills,
    update_displayed_stance_list,
    update_displayed_stance,
    update_displayed_faved_stances,
    update_stance_tooltip,
    stance_panel,
    skill_panel,
    levelary_panel,
    inventory_panel,
    update_displayed_location_types,
    open_crafting_window,
    close_crafting_window,
    switch_crafting_recipes_page,
    switch_crafting_recipes_subpage,
    update_displayed_book,
    update_other_save_load_button,
    update_displayed_family,
    update_displayed_family_members,
    format_numberL,
    get_character_power,
    get_power_rank,
    spec_stat,
};
