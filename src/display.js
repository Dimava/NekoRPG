"use strict";

import { traders } from "./traders.js";
import { current_trader, to_buy, to_sell, trade_state } from "./trade.js";
import { skills } from "./skills.js";
import { character, get_hero_xp_gain, get_skills_overall_xp_gain } from "./character.js";
import { current_enemies, options,
    can_work, current_location,
    active_effects, enough_time_for_earnings,
    get_current_book, last_location_with_bed,
    last_combat_location, faved_stances,
    selected_stance, unlock_location,
    global_flags, get_enemy_killcount,
    get_time_passed,family_data,init_family,
    realm_rate, get_baby_cost,
    inf_combat, game_state} from "./main.js";
import { dialogues } from "./dialogues.js";
import { activities } from "./activities.js";
import { format_time, current_game_time } from "./game_time.js";
import { book_stats, item_templates, Weapon, Armor, Shield , rarity_multipliers , getItemRarity , ScaledQualityMultiplier} from "./items.js";
import { REALMS } from "./realms.js";
import { get_location_type_penalty, location_types, locations } from "./locations.js";
import { enemy_killcount, enemy_templates } from "./enemies.js";
import { expo, format_reading_time, stat_names, get_hit_chance, round_item_price } from "./misc.js"
import { stances } from "./combat_stances.js";
import { recipes } from "./crafting_recipes.js";
import { effect_templates } from "./active_effects.js";
import { t, number_scale, current_lang } from "./i18n.js";
import { reactive, effect, toRaw, pauseTracking, resetTracking } from "@vue/reactivity";
import { ui_state } from "./ui_state.js";

let activity_anim; //for the activity animation interval

//location actions & trade
const action_div = document.getElementById("location_actions_div");
const trade_div = document.getElementById("trade_div");

/** replaced by the TimeAndLocation island (`src/islands/TimeAndLocation.vue`, `data-island="time-and-location"`)
 * const location_name_span = document.getElementById("location_name_span");
 * const location_types_div = document.getElementById("location_types_div");
 * const location_tooltip = document.getElementById("location_name_tooltip");
 */
const location_panel = reactive({ current: null, combat: false, pulse: 0 });

//inventory display
const inventory_div = document.getElementById("inventory_content_div");
let item_divs = {};
let item_buying_divs = {};
const trader_inventory_div = document.getElementById("trader_inventory_div");

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





let trader_inventory_sorting = "name";
let trader_inventory_sorting_direction = "asc";

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

const crafting_pages = {
    crafting: {
        items: document.querySelector(`[data-crafting_category="crafting"] [data-crafting_subcategory="items"]`),
        items2: document.querySelector(`[data-crafting_category="crafting"] [data-crafting_subcategory="items2"]`),
        items3: document.querySelector(`[data-crafting_category="crafting"] [data-crafting_subcategory="items3"]`),
        items4: document.querySelector(`[data-crafting_category="crafting"] [data-crafting_subcategory="items4"]`),
        components: document.querySelector(`[data-crafting_category="crafting"] [data-crafting_subcategory="components"]`),
        equipment: document.querySelector(`[data-crafting_category="crafting"] [data-crafting_subcategory="equipment"]`),
    },
    cooking: {
        items: document.querySelector(`[data-crafting_category="cooking"] [data-crafting_subcategory="items"]`),
        items2: document.querySelector(`[data-crafting_category="cooking"] [data-crafting_subcategory="items2"]`),
        items3: document.querySelector(`[data-crafting_category="cooking"] [data-crafting_subcategory="items3"]`),
        items4: document.querySelector(`[data-crafting_category="cooking"] [data-crafting_subcategory="items4"]`),
    },
    smelting: {
        items: document.querySelector(`[data-crafting_category="smelting"] [data-crafting_subcategory="items"]`),
        items2: document.querySelector(`[data-crafting_category="smelting"] [data-crafting_subcategory="items2"]`),
        items3: document.querySelector(`[data-crafting_category="smelting"] [data-crafting_subcategory="items3"]`),
        items4: document.querySelector(`[data-crafting_category="smelting"] [data-crafting_subcategory="items4"]`),
    },
    forging: {
        items: document.querySelector(`[data-crafting_category="forging"] [data-crafting_subcategory="items"]`),
        items2: document.querySelector(`[data-crafting_category="forging"] [data-crafting_subcategory="items2"]`),
        items3: document.querySelector(`[data-crafting_category="forging"] [data-crafting_subcategory="items3"]`),
        components: document.querySelector(`[data-crafting_category="forging"] [data-crafting_subcategory="components"]`),
    },
    alchemy: {
        items: document.querySelector(`[data-crafting_category="alchemy"] [data-crafting_subcategory="items"]`),
        items2: document.querySelector(`[data-crafting_category="alchemy"] [data-crafting_subcategory="items2"]`),
        items3: document.querySelector(`[data-crafting_category="alchemy"] [data-crafting_subcategory="items3"]`),
        items4: document.querySelector(`[data-crafting_category="alchemy"] [data-crafting_subcategory="items4"]`),
    }
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
    if(options.option_format_change && some_number > 1e6){
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

function clear_action_div() {
    action_div.replaceChildren();
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
                item_tooltip += `<br><br><b>品质: <span class="${rarity_colors[item.getRarity(options.quality[0])]}"> ${options.quality[0]}% </span> - <span class="${rarity_colors[item.getRarity(options.quality[1])]}"> ${options.quality[1]}% </span></b>`;
            } else {
                item_tooltip += `<br><br><b><span class="${rarity_colors[item.getRarity(quality)]}">品质: ${quality}% </span></b>`;
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
            item_tooltip += `<br><br><b>品质: <span class="${rarity_colors[item.getRarity(options.quality[0])]}"> ${options.quality[0]}% </span> - <span class="${rarity_colors[item.getRarity(options.quality[1])]}"> ${options.quality[1]}% </span></b>`;
        } else {
            item_tooltip += `<br><br><b class="${rarity_colors[item.getRarity(quality)]}">品质: ${quality}% </b>`;
        }
        if(item.component_tier) {
            item_tooltip += t`<br>部件等级: ${item.component_tier}`;
        }
        if(options?.quality?.length == 2){
            if(Object.keys(item.stats).length > 0 || item?.attack_value !== 0 || item?.attack_multiplier !== 1) {
                item_tooltip += `<br>基础属性: `;
            }
            if(item?.attack_value) {
                item_tooltip += `<br>攻击力: + ${format_number(item.attack_value)}`;
            }
            if(item?.defense_value) {
                item_tooltip += `<br>防御力: + ${format_number(item.defense_value)}`;
            }
        }
        else{
            if(Object.keys(item.stats).length > 0 || item?.attack_value !== 0 || item?.attack_multiplier !== 1) {
                item_tooltip += `<br>预期属性: `;
            }
            if(item?.attack_value) {
                item_tooltip += `<br>攻击力: + ${format_number(item.attack_value * ScaledQualityMultiplier(quality)) }`;
            }
            if(item?.defense_value) {
                item_tooltip += `<br>防御力: + ${format_number(item.defense_value * ScaledQualityMultiplier(quality))}`;
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

function end_activity_animation() {
    clearInterval(activity_anim);
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
            formatted += `, x${rewards.xp_multipliers[xp_multipliers[0]]} ${name} 经验获取`;
        } else {
            formatted = `x${rewards.xp_multipliers[xp_multipliers[0]]} ${name} 经验获取`;
        }
        for(let i = 1; i < xp_multipliers.length; i++) {
            let name;
            if(xp_multipliers[i] !== "all" && xp_multipliers[i] !== "hero" && xp_multipliers[i] !== "all_skill") {
                name = skills[xp_multipliers[i]].name();
            } else {
                name = MulNameMapR[xp_multipliers[i].replace("_"," ")];
            }
            formatted += `, x${rewards.xp_multipliers[xp_multipliers[i]]} ${name} 经验获取`;
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

function start_activity_animation(settings) {
    clearInterval(end_activity_animation);
    activity_anim = setInterval(() => { //sets a tiny little "animation" for activity text
        const action_status_div = document.getElementById("action_status_div");
        let end = "";
        if(action_status_div === null) return;
        if(action_status_div.innerHTML.endsWith("...")) {
            end = "...";
        } else if(action_status_div.innerHTML.endsWith("..")) {
            end = "..";
        } else if(action_status_div.innerHTML.endsWith("."))
            end = ".";

        if(settings?.book_title) {
            action_status_div.innerHTML = action_status_div.innerHTML.split(",")[0] + `, ${format_reading_time(item_templates[settings.book_title].getRemainingTime())} left`;
            action_status_div.innerHTML += end;
        }

        if(end.length < 3){
            action_status_div.innerHTML += ".";
        } else {
            action_status_div.innerHTML = action_status_div.innerHTML.substring(0, action_status_div.innerHTML.length - 3);
        }
     }, 600);
}

function update_displayed_trader() {
    action_div.style.display = "none";
    trade_state.pulse++;
}

/** replaced by the Inventory island (`src/islands/Inventory.vue`, `data-island="inventory"`) */
function update_displayed_money() {}

/**
 * 
 * @returns {HTMLElement}
 */
function create_trade_buttons() {

    const trade_buttons = document.createElement("div");
    trade_buttons.classList.add("trade_ammount_buttons");

    const trade_button_5 = document.createElement("div");
    trade_button_5.classList.add("trade_ammount_button");
    trade_button_5.innerText = "10";
    trade_button_5.setAttribute("data-trade_ammount", 10);
    trade_buttons.appendChild(trade_button_5);

    const trade_button_10 = document.createElement("div");
    trade_button_10.classList.add("trade_ammount_button");
    trade_button_10.innerText = "100";
    trade_button_10.setAttribute("data-trade_ammount", 100);
    trade_buttons.appendChild(trade_button_10);

    const trade_button_1000 = document.createElement("div");
    trade_button_1000.classList.add("trade_ammount_button");
    trade_button_1000.innerText = "1k";
    trade_button_1000.setAttribute("data-trade_ammount", 1000);
    trade_buttons.appendChild(trade_button_1000);

    const trade_button_max = document.createElement("div");
    trade_button_max.classList.add("trade_ammount_button");
    trade_button_max.innerText = "all";
    trade_button_max.setAttribute("data-trade_ammount", Infinity);
    trade_buttons.appendChild(trade_button_max);
    
    return trade_buttons;
}

function sort_displayed_inventory({sort_by = "name", target = "character", change_direction = false}) {
    let plus;
    let minus;
    if(target === "trader") {
        if(change_direction){
            if(sort_by && sort_by === trader_inventory_sorting) {
                if(trader_inventory_sorting_direction === "asc") {
                    trader_inventory_sorting_direction = "desc";
                } else {
                    trader_inventory_sorting_direction = "asc";
                }
            } else {
                if(sort_by === "name") {
                    trader_inventory_sorting_direction = "desc";
                } else {
                    trader_inventory_sorting_direction = "asc";
                }
            }
        }

        target = trader_inventory_div;
        plus = trader_inventory_sorting_direction==="asc"?-1:1;
        minus = trader_inventory_sorting_direction==="asc"?1:-1;
        trader_inventory_sorting = sort_by || "name";

    } else if(target === "character") {
        if(change_direction){
            if(sort_by && sort_by === inventory_panel.sort_by) {
                inventory_panel.direction = inventory_panel.direction === "asc" ? "desc" : "asc";
            } else {
                inventory_panel.direction = sort_by === "name" ? "desc" : "asc";
            }
        }
        inventory_panel.sort_by = sort_by || "name";
        return;
    }
    else {
        console.warn(`Something went wrong, no such inventory as '${target}'`);
        return;
    }
    [...target.children].sort((a,b) => {
        //equipped items on top
        if(a.classList.contains("equipped_item_control") && !b.classList.contains("equipped_item_control")) {
            return -1;
        } else if(!a.classList.contains("equipped_item_control") && b.classList.contains("equipped_item_control")){
            return 1;
        } 

        if(a.classList.contains("item_to_trade") && !b.classList.contains("item_to_trade")) {
            return 1;
        } else if(!a.classList.contains("item_to_trade") && b.classList.contains("item_to_trade")) {
            return -1;
        }

        if(a.classList.contains("character_item_equippable") && !b.classList.contains("character_item_equippable")) {
            return 1;
        } else if(!a.classList.contains("character_item_equippable") && b.classList.contains("character_item_equippable")){
            return -1;
        } 
        if(a.classList.contains("trader_item_equippable") && !b.classList.contains("trader_item_equippable")) {
            return 1;
        } else if(!a.classList.contains("trader_item_equippable") && b.classList.contains("trader_item_equippable")){
            return -1;
        } 

        if(a.children[0].children[0].children[0].innerText === "[Comp]" && b.children[0].children[0].children[0].innerText !== "[Comp]") {
            return 1;
        } else if(a.children[0].children[0].children[0].innerText !== "[Comp]" && b.children[0].children[0].children[0].innerText === "[Comp]") {
            return -1;
        }

        if(a.children[0].children[0].children[0].innerText === "[Book]" && b.children[0].children[0].children[0].innerText !== "[Book]") {
            return 1;
        } else if(a.children[0].children[0].children[0].innerText !== "[Book]" && b.children[0].children[0].children[0].innerText === "[Book]") {
            return -1;
        }

        if(a.getElementsByClassName("item_slot") && !b.getElementsByClassName("item_slot")) {
            return 1;
        } else if(!a.getElementsByClassName("item_slot") && b.getElementsByClassName("item_slot")) {
            return -1;
        }

        //other items by either name or otherwise by value

        if(sort_by === "name") {

            const tag_a = a.children[0].children[0].children[0].innerText.toLowerCase();
            const tag_b = b.children[0].children[0].children[0].innerText.toLowerCase();
            if(tag_a !== tag_b) {
                return tag_a > tag_b ? plus : minus;
            }

            const name_a = a.children[0].children[0].children[1].innerText.toLowerCase().replaceAll('"',"");
            const name_b = b.children[0].children[0].children[1].innerText.toLowerCase().replaceAll('"',"");
            if(name_a > name_b) {
                return plus;
            } else if(name_a < name_b) {
                return minus;
            } else {
                //if same name, sort based on quality 
                //works similar to sorting by value but is more precise
                //(shouldn't be possible to reach this for quality-less items)
                let value_a = Number.parseInt(a.dataset.item_quality);
                let value_b = Number.parseInt(b.dataset.item_quality);
                
                if(value_a > value_b) {
                    return plus;
                } else {
                    return minus;
                }
            }

        } else if(sort_by === "price") {
            
            let value_a = Number.parseInt(a.getAttribute(`data-item_value`));
            let value_b = Number.parseInt(b.getAttribute(`data-item_value`));
      
            if(value_a > value_b) {
                return plus;
            } else {
                if(value_a === value_b && "item_quality" in a.dataset && "item_quality" in b.dataset) {
                    if(Number.parseInt(a.dataset.item_quality) > Number.parseInt( b.dataset.item_quality)) {
                        return plus;
                    } else {
                        return minus;
                    }
                }
                return minus;
            }
        }

    }).forEach(node => target.appendChild(node));
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
 * creates a single item div for hero/trader, used to fill displayed inventories
 * @param {Object} params
 * @param {String} params.key 
 * @param {Number} params.item_count
 * @param {String} params.target character/trader
 * @param {Boolean} params.is_equipped
 * @param {Number} params.trade_index index in to_buy/to_sell
 * @returns 
 */
function create_inventory_item_div({key, item_count, target, is_equipped, trade_index}) {

    const item_control_div = document.createElement("div");
    const item_div = document.createElement("div");
    const item_name_div = document.createElement("div");
    const item_additional = document.createElement("div");
    item_additional.classList.add("item_additional_content");

    let target_item;
    let target_class_name;
    let item_class;
    let options = {};
    let price_multiplier = 1;
    if(target === "trader") {
        options.trader = true;
        price_multiplier = traders[current_trader].getProfitMargin() || price_multiplier;
    }

    if(is_equipped) {
        target_item = character.equipment[key];
        item_count = item_count ?? 1;
        item_class = "equipped_item";
        target_class_name = "character_item";
    } else {
        item_class = "inventory_item";
        if(target === "character") {
            if(typeof trade_index === "undefined") {
                target_item = character.inventory[key].item;
                item_count = item_count || character.inventory[key].count;
            } else {
                target_item = traders[current_trader].inventory[to_buy.items[trade_index].item_key].item;
                item_count = item_count || to_buy.items[trade_index].count;
            }
            target_class_name = "character_item";
        } else if(target === "trader") {
            if(typeof trade_index === "undefined") {
                target_item = traders[current_trader].inventory[key].item;
                item_count = item_count || traders[current_trader].inventory[key].count;
            } else {
                target_item = character.inventory[to_sell.items[trade_index].item_key].item;
                item_count = item_count || to_sell.items[trade_index].count;
            }
            target_class_name = "trader_item";
        } else {
            throw new Error(`"${target}" is not a correct inventory owner`);
        }
    }

    if("quality" in target_item) {
        item_control_div.dataset.item_quality = target_item.quality;
    }
    let EquipSlotMap = {"sword":"剑","head":"头部","trident":"三叉戟","moonwheel":"月轮","torso":"躯干","legs":"腿部","feet":"脚部","weapon":"武器","props":"道具","method":"秘法","special":"特殊","realm":"领域"};
    if(target_item.tags?.equippable) {
        if(target_item.tags.tool) {
            item_name_div.innerHTML = t`<span class = "item_slot" >[tool]</span> <span>${target_item.getDisplayName()}</span>`;
        } else {
            item_name_div.innerHTML = t`<span class = "item_slot" >[${EquipSlotMap[target_item.equip_slot]}]</span> <span class="${rarity_colors[target_item.getRarity()]}">${target_item.getDisplayName()}</span>`;
        }
        item_name_div.classList.add(`${item_class}_name`);
        item_div.appendChild(item_name_div);

        item_control_div.classList.add(`${item_class}_control`, `${target_class_name}_control`, `${target_class_name}_equippable`);
        item_control_div.appendChild(item_div);

        if(typeof trade_index !== "undefined") {
            item_div.classList.add(`${item_class}`, `${target_class_name}`, `trade_item_equippable`);
        } else {
            item_div.classList.add(`${item_class}`, `${target_class_name}`, `item_equippable`);
        }
        item_control_div.dataset.item_slot = target_item.equip_slot;
    } else if(target_item.tags.component) {
        item_name_div.innerHTML = t`<span class = "item_category">[${t("部件")}]</span> <span class="item_name"><span class="${rarity_colors[target_item.getRarity()]}">${target_item.getDisplayName()}</span></span>`;
        item_name_div.classList.add(`${item_class}_name`);
        item_div.appendChild(item_name_div);

        item_control_div.classList.add(`${item_class}_control`, `${target_class_name}_control`, `${target_class_name}_component`);
        item_control_div.appendChild(item_div);

        item_div.classList.add(`${item_class}`, `${target_class_name}`, "item_component");
    } else if(target_item.tags.book) {
        item_name_div.innerHTML = '<span class = "item_category">[Book]</span>';
        item_name_div.classList.add(`${item_class}`);
        item_name_div.innerHTML += ` <span class = "book_name item_name">"${target_item.getDisplayName()}"</span>`;

        if(book_stats[target_item.name].is_finished) {
            item_div.classList.add("book_finished");
        } else if(get_current_book() === target_item.name) {
            item_control_div.classList.add("book_active");
        }
    } else {
        item_name_div.innerHTML = t`<span class="item_image"><img src=${target_item.image}></span>`;
        item_name_div.innerHTML += `<span class = "item_category"></span> <span class = "item_name">${target_item.getDisplayName()}</span>`;
    }
    
    if(item_count != 1) {
        item_name_div.innerHTML += `<span class="item_count"> x${item_count}</span>`;
    } else if(item_count) {
        item_name_div.innerHTML += `<span class="item_count"></span>`;
    }
    item_name_div.classList.add(`${item_class}_name`);
    item_div.appendChild(item_name_div);

    item_div.classList.add(`${item_class}`, `${target_class_name}`, `item_${target_item.item_type.toLowerCase()}`);

    item_div.appendChild(create_item_tooltip(target_item, options));

    item_control_div.classList.add(`${item_class}_control`, `${target_class_name}_control`, `${target_class_name}_${target_item.item_type.toLowerCase()}`);
    item_control_div.setAttribute(`data-${target_class_name}`, `${target_item.getInventoryKey()}`)
    item_control_div.setAttribute("data-item_count", `${item_count}`)
    item_control_div.setAttribute("data-item_value", `${target_item.getValue()}`);
    item_control_div.appendChild(item_div);

    if(target === "character") {
        if(target_item.item_type === "USABLE") {
            //if(target_item.gem_value != 0) {
                
                const item_use_max = document.createElement("div");
                item_use_max.classList.add("item_use_button");
                item_use_max.classList.add("item_use_max");
                item_use_max.innerText = "[Max]";
                item_additional.appendChild(item_use_max);



                const item_use_10 = document.createElement("div");
                item_use_10.classList.add("item_use_button");
                item_use_10.classList.add("item_use_10");
                item_use_10.innerText = "[x10]";
                item_additional.appendChild(item_use_10);
            //}
            const item_use_button = document.createElement("div");
            item_use_button.classList.add("item_use_button");
            item_use_button.innerText = t("[使用]");
            item_additional.appendChild(item_use_button);
            
        } else if(target_item.item_type === "BOOK") {
            const item_read_button = document.createElement("div");
            item_read_button.classList.add("item_use_button");
            item_read_button.innerText = t("[阅读]");
            item_additional.appendChild(item_read_button);

            item_div.classList.add("item_book");
        }
        if(typeof trade_index === "undefined" && target_item.tags.equippable) {
            if(!is_equipped) {
                let item_equip_span = document.createElement("span");
                item_equip_span.innerHTML = t("[装备]");
                item_equip_span.classList.add("equip_item_button", "item_controls");
                item_additional.appendChild(item_equip_span);
            } else {
                let item_unequip_div = document.createElement("div");
                item_unequip_div.innerHTML = t("[卸下]");
                item_unequip_div.classList.add("unequip_item_button", "item_controls");
                item_additional.appendChild(item_unequip_div);
            }
        }
    } 
    
    item_additional.appendChild(create_trade_buttons());


    let item_value_span = document.createElement("span");
    item_value_span.innerHTML = t`${format_money(round_item_price(target_item.getValue()*price_multiplier), true)}`;
    item_value_span.classList.add("item_value", "item_controls");
    item_additional.appendChild(item_value_span);
    item_control_div.appendChild(item_additional);

    if(typeof trade_index !== "undefined") {
        item_control_div.classList.add('item_to_trade');
        if(item_control_div.classList.contains("trader_item_control")){
            item_value_span.innerHTML = t`${format_money(round_item_price(target_item.getValue()), true)}`;
        }
        if(item_control_div.classList.contains("character_item_control")){
            item_value_span.innerHTML = t`${format_money(round_item_price(target_item.getValue()*traders[current_trader].getProfitMargin()), true)}`;
        }
    }

    return item_control_div;
}

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

let painting_location_actions = false;

function update_displayed_normal_location(location) {
    if (painting_location_actions) return;
    painting_location_actions = true;
    try {
    clear_action_div();
    location_panel.current = location;
    location_panel.combat = false;
    location_panel.pulse++;
    /** replaced by the TimeAndLocation island
     * location_types_div.innerHTML = "";
     * location_tooltip.innerText = "";
     * document.documentElement.style.setProperty('--location_desc_tooltip_visibility', "hidden");
     */
    combat_div.style.display = "none";
    document.documentElement.style.setProperty('--actions_div_height', getComputedStyle(document.body).getPropertyValue('--actions_div_height_default'));
    document.documentElement.style.setProperty('--actions_div_top', getComputedStyle(document.body).getPropertyValue('--actions_div_top_default'));
    
    /** replaced by the PanelSwitch island (`src/islands/PanelSwitch.vue`, `data-island="panel-switch"`)
     * inventory_switch.click();
     * combat_switch.style.pointerEvents = "none";
     * combat_switch.style.cursor = "default";
     * combat_switch.style.color = "gray";
     */
    ui_state.inventoryTab = 'inventory';
    
    ////////////////////////////////////
    //add buttons for starting dialogues

    const available_dialogues = location.dialogues.filter(dialogue => {
        if(!dialogues[dialogue].is_unlocked || dialogues[dialogue].is_finished) {
            return false;
        } else {
            let lines_available = false;
            Object.keys(dialogues[dialogue].textlines).forEach(line => {
                if(lines_available) {
                    return;
                } else {
                    lines_available = dialogues[dialogue].textlines[line].is_unlocked && !dialogues[dialogue].textlines[line].is_finished;
                }
            });
            return lines_available;
        }
    });

    if(available_dialogues.length > 2) {
        //there's multiple -> add a choice to location actions that will show all available dialogues        
        const dialogues_button = document.createElement("div");
        dialogues_button.setAttribute("data-location", location.name);
        dialogues_button.classList.add("location_choices");
        dialogues_button.setAttribute("onclick", 'update_displayed_location_choices({location_name: this.getAttribute("data-location"), category: "talk"})');
        dialogues_button.innerHTML = '<i class="material-icons">format_list_bulleted</i>  Talk to someone';
        action_div.appendChild(dialogues_button);
    } else if (available_dialogues.length <= 2) {
        //there's only 1 -> put it in overall location choice list
        action_div.append(...create_location_choices({location: location, category: "talk"}));
    }

    /////////////////////////
    //add buttons for trading

    const available_traders = location.traders.filter(trader => traders[trader].is_unlocked);

    if(available_traders.length > 2) {     
        const traders_button = document.createElement("div");
        traders_button.setAttribute("data-location", location.name);
        traders_button.classList.add("location_choices");
        traders_button.setAttribute("onclick", 'update_displayed_location_choices({location_name: this.getAttribute("data-location"), category: "trade"})');
        traders_button.innerHTML = '<i class="material-icons">format_list_bulleted</i>  Visit a merchant';
        action_div.appendChild(traders_button);
    } else if (available_traders.length > 0) {
        action_div.append(...create_location_choices({location: location, category: "trade"}));
    }

    ///////////////////////////
    //add buttons to start jobs

    const available_jobs = Object.values(location.activities).filter(activity => activities[activity.activity_name].type === "JOB" 
                                                                    && activities[activity.activity_name].is_unlocked
                                                                    && activity.is_unlocked
                                                                    && activities[activity.activity_name].base_skills_names.filter(skill => !skills[skill].is_unlocked).length == 0);
    if(available_jobs.length > 2) {     
        const jobs_button = document.createElement("div");
        jobs_button.setAttribute("data-location", location.name);
        jobs_button.classList.add("location_choices");
        jobs_button.setAttribute("onclick", 'update_displayed_location_choices({location_name: this.getAttribute("data-location"), category: "work"})');
        jobs_button.innerHTML = '<i class="material-icons">format_list_bulleted</i>  Find some work';
        action_div.appendChild(jobs_button);
    } else if (available_jobs.length <= 2) {
        action_div.append(...create_location_choices({location: location, category: "work"}));
    }

    ///////////////////////////////
    //add buttons to start training

    const available_trainings = Object.values(location.activities).filter(activity => activities[activity.activity_name].type === "TRAINING" 
                                                                    && activities[activity.activity_name].is_unlocked
                                                                    && activity.is_unlocked
                                                                    && activities[activity.activity_name].base_skills_names.filter(skill => !skills[skill].is_unlocked).length == 0);
    if(available_trainings.length > 2) {     
        const trainings_button = document.createElement("div");
        trainings_button.setAttribute("data-location", location.name);
        trainings_button.classList.add("location_choices");
        trainings_button.setAttribute("onclick", 'update_displayed_location_choices({location_name: this.getAttribute("data-location"), category: "train"})');
        trainings_button.innerHTML = '<i class="material-icons">format_list_bulleted</i>  Train for a bit';
        action_div.appendChild(trainings_button);
    } else if (available_trainings.length <= 2) {
        action_div.append(...create_location_choices({location: location, category: "train"}));
    }

    ////////////////////////////////
    //add buttons to start gathering
    let available_gatherings = [];
    if(global_flags.is_gathering_unlocked) {
        available_gatherings = Object.values(location.activities).filter(activity => activities[activity.activity_name].type === "GATHERING"
                                                                        && activities[activity.activity_name].is_unlocked
                                                                        && activity.is_unlocked
                                                                        && activities[activity.activity_name].base_skills_names.filter(skill => !skills[skill].is_unlocked).length == 0);
        if(available_gatherings.length > 2) {
            const gatherings_button = document.createElement("div");
            gatherings_button.setAttribute("data-location", location.name);
            gatherings_button.classList.add("location_choices");
            gatherings_button.setAttribute("onclick", 'update_displayed_location_choices({location_name: this.getAttribute("data-location"), category: "gather"})');
            gatherings_button.innerHTML = '<i class="material-icons">format_list_bulleted</i>  Gather some resources';
            action_div.appendChild(gatherings_button);
        } else if (available_gatherings.length <= 2) {
            action_div.append(...create_location_choices({location: location, category: "gather"}));
        }
    }

    ///////////////////////////
    //add button to go to sleep

    if(location.sleeping) { 
        const start_sleeping_div = document.createElement("div");
        
        start_sleeping_div.innerHTML = t`<span style = "color:#cce0ff"><i class="material-icons">bed</i>  ${location.sleeping.text}</span>`;
        start_sleeping_div.id = "start_sleeping_div";
        start_sleeping_div.setAttribute('onclick', 'start_sleeping()');

        action_div.appendChild(start_sleeping_div);
    }
    
    ////////////////////////////
    //add buttons for challenges
    //not getting foldered since having too many is not expected
    action_div.append(...create_location_choices({location: location, category: "challenge"}));


    /////////////////////////////
    //add button to open crafting
    if(global_flags.is_crafting_unlocked) {
        if(location.crafting?.is_unlocked) {
            const crafting_button = document.createElement("div");
            crafting_button.classList.add("location_choices");
            crafting_button.setAttribute("onclick", 'openCraftingWindow()');
            crafting_button.innerHTML = t`<span style="color:#c0ffc0"><i class="material-icons">construction</i> ${location.crafting.use_text}</span>`;
            action_div.appendChild(crafting_button);
        }
    }

    /////////////////////////////////
    //add butttons to change location

    const available_locations = location.connected_locations.filter(loc => loc.location.is_unlocked && !loc.location.is_finished && !loc.location.is_challenge);
    const available_challenges = location.connected_locations.filter(loc => loc.location.is_challenge && loc.location.is_unlocked && !loc.location.is_finished);
    // sleeping is `{text, xp}` or null; `sleeping + n` was NaN / "[object Object]…" so the fold never fired on bed locations.
    const other_action_count = (location.sleeping ? 1 : 0)
        + available_trainings.length
        + available_jobs.length
        + available_traders.length
        + available_dialogues.length
        + available_gatherings.length
        + available_challenges.length
        + (global_flags.is_crafting_unlocked && location.crafting?.is_unlocked ? 1 : 0);

    if(available_locations.length > 3 && other_action_count > 2) {
        const locations_button = document.createElement("div");
        locations_button.setAttribute("data-location", location.name);
        locations_button.classList.add("location_choices");
        locations_button.setAttribute("onclick", 'update_displayed_location_choices({location_name: this.getAttribute("data-location"), category: "travel"});');
        locations_button.innerHTML = '<i class="material-icons">format_list_bulleted</i>  ' + t("展开");
        action_div.appendChild(locations_button);
    } else if(available_locations.length > 0) {
        action_div.append(...create_location_choices({location: location, category: "travel"}));
    }

    /** replaced by the TimeAndLocation island
     * location_name_span.innerText = t(current_location.name);
     */
    // description and S3 HUD: src/islands/LocationDescription.vue
    } finally {
        painting_location_actions = false;
    }
}

/**
 * 
 * @param {*} location 
 * @param {*} category 
 * @return {Array} an array of html nodes presenting the available choices
 */
function create_location_choices({location, category, add_icons = true, is_combat = false}) {
    let choice_list = [];
    
    if(category === "talk") {
        for(let i = 0; i < location.dialogues.length; i++) { 
            if(!dialogues[location.dialogues[i]].is_unlocked || dialogues[location.dialogues[i]].is_finished) { //skip if dialogue is not available
                continue;
            } 
            let lines_available = false;
            Object.keys(dialogues[location.dialogues[i]].textlines).forEach(line =>{
                if(lines_available) {
                    return;
                } else {
                   lines_available = dialogues[location.dialogues[i]].textlines[line].is_unlocked && !dialogues[location.dialogues[i]].textlines[line].is_finished;
                }
            })

            // const lines_available = location.dialogues.filter(dialogue => {
            //         let lines_available = false;
            //         Object.keys(dialogues[dialogue].textlines).forEach(line => {
            //             if(lines_available) {
            //                 return;
            //             } else {
            //                 lines_available = dialogues[dialogue].textlines[line].is_unlocked && !dialogues[dialogue].textlines[line].is_finished;
            //             }
            //         });
            //         return lines_available;
            // }).length > 0;
            if(!lines_available) {
                continue;
            }


            
            const dialogue_div = document.createElement("div");
    
            //if(Object.keys(dialogues[location.dialogues[i]].textlines).length > 0) { //has any textlines
                
            const dialogue = dialogues[location.dialogues[i]];
            const npcName = dialogue.name;
            dialogue_div.innerHTML = add_icons ? `<i class="material-icons">question_answer</i>  ` : "";
            dialogue_div.innerHTML += dialogue.starting_text === `与 ${npcName} 对话`
                ? t`与 ${npcName} 对话`
                : t(dialogue.starting_text);
            dialogue_div.classList.add("start_dialogue");
            dialogue_div.setAttribute("data-dialogue", location.dialogues[i]);
            dialogue_div.setAttribute("onclick", "start_dialogue(this.getAttribute('data-dialogue'));");
            choice_list.push(dialogue_div);
            //}
        }
    } else if (category === "trade") {
        for(let i = 0; i < location.traders.length; i++) { 
            if(!traders[location.traders[i]].is_unlocked) { //skip if trader is not available
                continue;
            } 
            
            const trader_div = document.createElement("div");
            const trader = traders[location.traders[i]];
            const traderName = trader.name;

            trader_div.innerHTML = trader.trade_text.includes("storefront")
                ? t`<span style="color:#ffffd0"> <i class="material-icons">storefront</i> 与 ${traderName} 交易</span>`
                : t(trader.trade_text);
            trader_div.classList.add("start_trade");
            trader_div.setAttribute("data-trader", location.traders[i]);
            trader_div.setAttribute("onclick", "startTrade(this.getAttribute('data-trader'));");
            choice_list.push(trader_div);
        }
    } else if (category === "work") {
        Object.keys(location.activities).forEach(key => {
            if(!activities[location.activities[key].activity_name]?.is_unlocked 
                || !location.activities[key]?.is_unlocked 
                || activities[location.activities[key].activity_name].type !== "JOB") 
            {
                return;
            }
            
            const activity_div = document.createElement("div");

            activity_div.innerHTML = t`<i class="material-icons">work_outline</i>  `;
            activity_div.classList.add("activity_div");
            activity_div.setAttribute("data-activity", key);
            activity_div.setAttribute("onclick", "start_activity(this.getAttribute('data-activity'));");

            if(can_work(location.activities[key])) {
                activity_div.classList.add("start_activity");
            } else {
                activity_div.classList.add("activity_unavailable");
            }

            const job_tooltip = document.createElement("div");
            job_tooltip.classList.add("job_tooltip");
            if(!location.activities[key].infinite){
                job_tooltip.innerHTML = t`Available from ${location.activities[key].availability_time.start} to ${location.activities[key].availability_time.end} <br>`;
            }
            job_tooltip.innerHTML += `Pays ${format_money(location.activities[key].get_payment())} per every ` +  
                    `${format_time({time: {minutes: location.activities[key].working_period}})} worked`;
            

            activity_div.appendChild(job_tooltip);
    
            activity_div.innerHTML += t(location.activities[key].starting_text);
            choice_list.push(activity_div);
        });
    } else if (category === "train") {
        Object.keys(location.activities).forEach(key => {
            if(!activities[location.activities[key].activity_name]?.is_unlocked 
                || !location.activities[key]?.is_unlocked 
                || activities[location.activities[key].activity_name].type !== "TRAINING"
                || activities[location.activities[key].activity_name].base_skills_names.filter(skill => !skills[skill].is_unlocked).length > 0) 
            {
                return;
            }

            const activity_div = document.createElement("div");

            activity_div.innerHTML = t`<span style="color:#d8c0ff"><i class="material-icons">fitness_center</i> </span> `;
            activity_div.classList.add("activity_div", "start_activity");
            activity_div.setAttribute("data-activity", key);
            activity_div.setAttribute("onclick", "start_activity(this.getAttribute('data-activity'));");
    
            activity_div.innerHTML += `<span style="color:#d8c0ff">` + t(location.activities[key].starting_text) + "</span>";
            choice_list.push(activity_div);
        });
    } else if (category === "gather") {
        Object.keys(location.activities).forEach(key => {
            if(!activities[location.activities[key].activity_name]?.is_unlocked 
                || !location.activities[key]?.is_unlocked 
                || activities[location.activities[key].activity_name].type !== "GATHERING"
                || activities[location.activities[key].activity_name].base_skills_names.filter(skill => !skills[skill].is_unlocked).length > 0) 
            {
                return;
            }

            const activity_div = document.createElement("div");

            activity_div.innerHTML = t`<span style="color:#ffc0d0"><i class="material-icons">search</i>  `;
            activity_div.classList.add("activity_div", "start_activity");
            activity_div.setAttribute("data-activity", key);
            activity_div.setAttribute("onclick", "start_activity(this.getAttribute('data-activity'));");

            activity_div.appendChild(create_gathering_tooltip(location.activities[key]));
    
            activity_div.innerHTML +=  `<span style="color:#ffc0e0">` + t(location.activities[key].starting_text) + "</span>";
            choice_list.push(activity_div);
        });
    } else if (category === "travel") {
        if(!is_combat){
            for(let i = 0; i < location.connected_locations.length; i++) { 
                
                if(location.connected_locations[i].location.is_unlocked == false || location.connected_locations[i].location.is_finished) { //skip if not unlocked or if finished
                    continue;
                }
                if(location.connected_locations[i].location.is_challenge) {
                    continue;
                    //challenges displayed separately
                }

                const action = document.createElement("div");
                
                if("connected_locations" in location.connected_locations[i].location) {// check again if connected location is normal or combat
                    action.classList.add("travel_normal");
                    if("custom_text" in location.connected_locations[i]) {
                        action.innerHTML = t`<i class="material-icons">directions</i> ${location.connected_locations[i].custom_text}`;
                    }
                    else {
                        action.innerHTML = t`<i class="material-icons">directions</i>  前往 [${location.connected_locations[i].location.name}]`;
                    }
                } else {
                    action.classList.add("travel_combat");
                    if("custom_text" in location.connected_locations[i]) {
                        action.innerHTML = t`<span style="color:#ffc0c0"><i class="material-icons">warning_amber</i> ${location.connected_locations[i].custom_text}</span>`;
                    }
                    else {
                        action.innerHTML = t`<span style="color:#ffc0c0"><i class="material-icons">warning_amber</i>  进入 [${location.connected_locations[i].location.name}]</span>`;
                    }
                }
            
                action.classList.add("action_travel");
                action.setAttribute("data-travel", location.connected_locations[i].location.name);
                action.setAttribute("onclick", "change_location(this.getAttribute('data-travel'));");
        
                choice_list.push(action);
            } 

            if(last_combat_location && location.connected_locations.filter(loc => loc.location.name === last_combat_location).length == 0) {
                const last_combat = locations[last_combat_location];
                const action = document.createElement("div");
                action.classList.add("travel_combat", "travel_fast_return");
                
                action.innerHTML = t`<span style="color:#ffd8c0"><i class="material-icons">warning_amber</i>  快速返回 [${last_combat.name}]</span>`;
                
                action.classList.add("action_travel");
                action.setAttribute("data-travel", last_combat.name);
                action.setAttribute("onclick", "change_location(this.getAttribute('data-travel'));");
        
                choice_list.push(action);
            }
        } else {
            const action = document.createElement("div");
            action.classList.add("travel_normal", "action_travel");
            if(location.leave_text) {
                action.innerHTML = t`<i class="material-icons">directions</i>  ${location.leave_text}`;
            } else {
                action.innerHTML = t`<i class="material-icons">directions</i>  回到 ${location.parent_location.name}`;
            }
            action.setAttribute("data-travel", location.parent_location.name);
            action.setAttribute("onclick", "change_location(this.getAttribute('data-travel'));");

            choice_list.push(action);
        }

        if((!inf_combat.S3?.live) && last_location_with_bed && !location.sleeping && (!location.connected_locations || location?.connected_locations?.filter(loc => loc.location.name === last_location_with_bed).length == 0)) {
            const last_bed = locations[last_location_with_bed];

            const action = document.createElement("div");
            action.classList.add("travel_normal", "travel_fast_return");
            
            action.innerHTML = t`<span style="color:#c0c0ff"><i class="material-icons">directions</i> 快速返回 [${last_bed.name}]</span>`;
            
            action.classList.add("action_travel");
            action.setAttribute("data-travel", last_bed.name);
            action.setAttribute("onclick", "change_location(this.getAttribute('data-travel'));");
    
            choice_list.push(action);
        }

        choice_list.sort((a,b) => b.classList.contains("travel_normal") - a.classList.contains("travel_normal"));
    } else if (category === "challenge") {

        const available_challenges = location.connected_locations.filter(location => {if(location.location.is_challenge && location.location.is_unlocked && !location.location.is_finished) return true});
       
        for(let i = 0; i < available_challenges.length; i++) { 
            const action = document.createElement("div");

            action.classList.add("travel_combat");
            if("custom_text" in available_challenges[i]) {
                action.innerHTML = t`<span style="color:#ff8080"><i class="material-icons icon">warning_amber</i>  ${available_challenges[i].custom_text}</span>`;
            }
            else {
                action.innerHTML = t`<span style="color:#ff8080"><i class="material-icons">warning_amber</i>  进入 ${available_challenges[i].location.name}</span>`;
            }
            
            action.classList.add("action_travel");
            action.setAttribute("data-travel", available_challenges[i].location.name);
            action.setAttribute("onclick", "change_location(this.getAttribute('data-travel'));");
    
            choice_list.push(action);
        }
    }

    return choice_list;
}

function update_displayed_location_choices({location_name, category, add_icons, is_combat}) {
    action_div.replaceChildren(...create_location_choices({location: locations[location_name], category: category, add_icons: add_icons, is_combat: is_combat}));
    const return_button = document.createElement("div");
    return_button.innerHTML = "<i class='material-icons'>arrow_back</i> " + t("收起");
    return_button.setAttribute("onclick", "reload_normal_location()");
    return_button.classList.add("choices_return_button");
    action_div.appendChild(return_button);
}

function update_displayed_combat_location(location,disable_switch = false) {
    if (painting_location_actions) return;
    painting_location_actions = true;
    try {

    /** replaced by the TimeAndLocation island
     * document.documentElement.style.setProperty('--location_desc_tooltip_visibility', "visible");
     */
    clear_action_div();
    location_panel.combat = true;
    /** replaced by the TimeAndLocation island
     * location_types_div.innerHTML = "";
     */
    let action;

    combat_div.style.display = "block";

    if(!options.disable_combat_autoswitch && !disable_switch) {
        /** replaced by the PanelSwitch island
         * combat_switch.click();
         * combat_switch.classList.add("active_selection_button");
         * inventory_switch.classList.remove("active_selection_button");
         */
        ui_state.inventoryTab = 'combat';
    }
    /** replaced by the PanelSwitch island
     * combat_switch.style.pointerEvents = "auto";
     * combat_switch.style.cursor = "pointer";
     * combat_switch.style.color = "white";
     */

    document.documentElement.style.setProperty('--actions_div_height', getComputedStyle(document.body).getPropertyValue('--actions_div_height_combat'));
    document.documentElement.style.setProperty('--actions_div_top', getComputedStyle(document.body).getPropertyValue('--actions_div_top_combat'));

    action = create_location_choices({location: location, category: "travel", is_combat: true});

    action_div.append(...action);

    /** replaced by the TimeAndLocation island
     * location_name_span.innerText = t(current_location.name);
     * location_tooltip.innerText = t(current_location.getDescription());
     * location_tooltip.classList.add("location_tooltip");
     * if(current_location.types.length == 0) {
     *     document.documentElement.style.setProperty('--location_name_div_width', '390px');
     * } else {
     *     document.documentElement.style.setProperty('--location_name_div_width', '250px');
     * }
     */
    
    create_location_types_display(current_location);
    } finally {
        painting_location_actions = false;
    }
}

let location_actions_i18n_tick = 0;
effect(() => {
    current_lang();
    if (++location_actions_i18n_tick === 1) return;
    pauseTracking();
    try {
        if (!current_location) return;
        const gs = toRaw(game_state);
        if (gs.current_activity || gs.current_dialogue || gs.is_sleeping || gs.is_reading) return;
        if (toRaw(trade_state).current_trader) return;
        const loc = toRaw(current_location);
        if ("connected_locations" in loc) update_displayed_normal_location(loc);
        else update_displayed_combat_location(loc, true);
    } finally {
        resetTracking();
    }
});

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
    document.getElementById("crafting_mainpage_buttons").children[0].click();
    
    let elements = document.querySelectorAll(`[data-crafting_subcategory]`);
    for(let i = 0; i < elements.length; i++) {
        if(!elements[i].dataset.crafting_subcategory.includes("items")) {
            elements[i].style.display = "none";
        } else {
            elements[i].style.display = "";
        } 
    }

    elements = document.getElementsByClassName("crafting_subpage_buttons");
    for(let i = 0; i < elements.length; i++) {
        elements[i].children[0].click();
    }

    update_displayed_crafting_recipes();
}

function close_crafting_window() {
    action_div.style.display = "block";
    document.getElementById("crafting_window").style.display = "none";
    update_displayed_normal_location(current_location);
}

/**
 * switches between main pages of crafting menu (crafting, alchemy, cooking, etc)
 * @param {String} category 
 */
function switch_crafting_recipes_page(category) {
    const elements = document.querySelectorAll('[data-crafting_category]');
    for(let i = 0; i < elements.length; i++) {
        
        if(!elements[i].dataset.crafting_subcategory) {
            if(elements[i].dataset.crafting_category !== category) {
                elements[i].style.display = "none";
            } else {
                elements[i].style.display = "";
            }
        } 
    }

    unexpand_displayed_recipes();
}

/**
 * switches between subpages of a crafting page (items-components-equipment)
 * @param {String} category 
 * @param {String} subcategory 
 */
function switch_crafting_recipes_subpage(category, subcategory) {
    const elements = document.querySelectorAll(`[data-crafting_category='${category}'], [data-crafting_subcategory]`);
    for(let i = 0; i < elements.length; i++) {
        if(elements[i].dataset.crafting_subcategory) {
            if(elements[i].dataset.crafting_category === category) {
                if(elements[i].dataset.crafting_subcategory !== subcategory) {
                    elements[i].style.display = "none";
                } else {
                    elements[i].style.display = "";
                } 
            }
        }
    }

    unexpand_displayed_recipes();
}

function unexpand_displayed_recipes() {
    const classes = ["selected_recipe", "selected_component_list", "selected_component_category"];
    for(let i = 0; i < classes.length; i++) {
        const elements = document.getElementsByClassName(classes[i]);
        for(let j = 0 ; j < elements.length; j++) {
            elements[j].classList.remove(classes[i]);
        }
    }
}

function create_displayed_crafting_recipes() {
    Object.keys(recipes).forEach(recipe_category => {
        Object.keys(recipes[recipe_category]).forEach(recipe_subcategory => {
            if(recipe_subcategory.includes("items")) {
                crafting_pages[recipe_category][recipe_subcategory].innerHTML = "";
            }
            Object.keys(recipes[recipe_category][recipe_subcategory]).forEach(recipe => {
                if(!((recipe == '月轮' ) && (!global_flags["is_moonwheel_unlocked"]))) add_crafting_recipe_to_display({category: recipe_category, subcategory: recipe_subcategory, recipe_id: recipe});
            });
        });
    });

    update_item_recipe_visibility();
}

function unlock_moonwheel() {
    Object.keys(recipes).forEach(recipe_category => {
        Object.keys(recipes[recipe_category]).forEach(recipe_subcategory => {
            Object.keys(recipes[recipe_category][recipe_subcategory]).forEach(recipe => {
                if((recipe == '月轮')) add_crafting_recipe_to_display({category: recipe_category, subcategory: recipe_subcategory, recipe_id: recipe});
            });
        });
    });
    update_item_recipe_visibility();
}//解锁月轮


function add_crafting_recipe_to_display({category, subcategory, recipe_id}) {
    const recipe = recipes[category][subcategory][recipe_id];
    const recipe_div = document.createElement("div");
    recipe_div.innerHTML = t`<span class="recipe_name">${recipe.name}</span>`;

    recipe_div.classList.add("recipe_div");
    recipe_div.dataset.recipe_id = recipe_id;

    if(subcategory.includes("items")) {
        
        const recipe_max = document.createElement("span");
        recipe_max.classList.add("recipe_10_button");
        recipe_max.classList.add("recipe_10");
        recipe_max.innerText="[max]";
        recipe_div.appendChild(recipe_max);

        recipe_div.children[0].innerHTML = '<i class="material-icons icon" style="visibility:hidden"> keyboard_double_arrow_down </i>' + recipe_div.children[0].innerHTML;
        //invisible icon added just so it properly matches in height and text position with recipes in other subcategories
        if(!recipe.get_availability()) {
            recipe_div.classList.add("recipe_unavailable");
        }

        recipe_div.addEventListener("click", (event)=>{
            if(event.target.classList.contains("recipe_name") && !event.target.parentNode.classList.contains("recipe_unavailable")) {
                window.useRecipe(event.target);
                //normal items
            }
        });
        recipe_max.addEventListener("click", (event)=>{
            window.useRecipemax(event.target);
                //normal items
        });

        recipe_div.append(create_recipe_tooltip({category, subcategory, recipe_id}));
        
        

    } else if(subcategory === "components") {
        recipe_div.children[0].innerHTML = '<i class="material-icons icon crafting_dropdown_icon"> keyboard_double_arrow_down </i>' + recipe_div.children[0].innerHTML;
        const material_selection = document.createElement("div");
        material_selection.classList.add("folded_material_list");
        
        recipe_div.addEventListener("click", (event)=>{
            if(event.target.classList.contains("recipe_name") || event.target.classList.contains("crafting_dropdown_icon")) {
                window.updateDisplayedMaterialChoice({category, subcategory, recipe_id});
                toggle_exclusive_class({element: recipe_div, class_name: "selected_recipe"});
            } 
        });
        

        recipe_div.append(material_selection);
    } else if(recipe.recipe_type === "component") {
        //component but from other category, which generally means clothing
        if(recipe.item_type === "Armor") {
            recipe_div.classList.add("clothing_recipe");
        }

        recipe_div.children[0].innerHTML = '<i class="material-icons icon crafting_dropdown_icon"> keyboard_double_arrow_down </i>' + recipe_div.children[0].innerHTML;
        const material_selection = document.createElement("div");
        material_selection.classList.add("folded_material_list");
        recipe_div.addEventListener("click", (event)=>{
            if(event.target.classList.contains("recipe_name") || event.target.classList.contains("crafting_dropdown_icon")) {
                window.updateDisplayedMaterialChoice({category, subcategory, recipe_id});
                toggle_exclusive_class({element: recipe_div, class_name: "selected_recipe"});
            } 
        });

        recipe_div.append(material_selection);
    } else if(subcategory === "equipment") {
        if(recipe.item_type === "Armor") {
            recipe_div.classList.add("armor_recipe");
        } else if(recipe.item_type === "Weapon") {
            recipe_div.classList.add("weapon_recipe");
        } else if(recipe.item_type === "Shield") {
            recipe_div.classList.add("shield_recipe");
        } else {
            console.warn(`Recipe "${category}" -> "${subcategory}" -> "${recipe_id}" has wrong type of resulting item ("${recipe.item_type}")`)
        }
        
        recipe_div.children[0].innerHTML = '<i class="material-icons icon crafting_dropdown_icon"> keyboard_double_arrow_down </i>' +  recipe_div.children[0].innerHTML;
        let ComponentNameMap = {"long blade":"剑刃","triple blade":"三叉戟头","short handle":"剑柄","helmet exterior":"头部外甲","chestplate exterior":"胸部外甲","leg armor exterior":"腿部外甲","shoes exterior":"脚部外甲","helmet interior":"头部内甲","chestplate interior":"胸部内甲","leg armor interior":"腿部内甲","shoes interior":"脚部内甲","wheel core":"轮芯","wheel head":"轮锋"}
        const component_selection_1 = document.createElement("div"); //weapon head or internal armor
        component_selection_1.innerHTML = t`<span class="crafting_selection"><i class="material-icons icon subcrafting_dropdown_icon"> keyboard_double_arrow_down </i>${t`选择一个[${ComponentNameMap[recipe.components[0]]}]`}</span>`;
        
        const component_1_list = document.createElement("div");
        component_1_list.classList.add("folded_crafting_selection");
        component_selection_1.appendChild(component_1_list);

        const component_selection_2 = document.createElement("div"); //weapon handle or external armor
        component_selection_2.innerHTML = t`<span class="crafting_selection"><i class="material-icons icon subcrafting_dropdown_icon"> keyboard_double_arrow_down </i>${t`选择一个[${ComponentNameMap[recipe.components[1]]}]`}</span>`;
        
        const component_2_list = document.createElement("div");
        component_2_list.classList.add("folded_crafting_selection");
        component_selection_2.appendChild(component_2_list);

        const component_selections = document.createElement("div");
        component_selections.classList.add("component_selections");
        component_selections.append(component_selection_1);
        component_selections.append(component_selection_2);

        recipe_div.addEventListener("click", (event)=>{
            if(event.target.classList.contains("recipe_name") || event.target.classList.contains("crafting_dropdown_icon")) {
                
                const expanded_divs = recipe_div.querySelectorAll(".selected_component_category");
                for(let i = 0; i < expanded_divs.length; i++) {
                    expanded_divs.item(i).classList.remove("selected_component_category");
                    expanded_divs.item(i).nextSibling.classList.remove("selected_component_list");
                }
                
                toggle_exclusive_class({element: recipe_div, class_name: "selected_recipe"});
                window.updateDisplayedComponentChoice({category, subcategory, recipe_id});

                update_recipe_tooltip({category, subcategory, recipe_id, components: []});
            }
        });

        component_selection_1.parentNode.children[0].addEventListener("click", (event)=>{
            //unfold a list for selection; its content already loaded by a different function
            if(event.target.classList.contains("crafting_selection")) {
                component_selection_1.children[1].classList.toggle("selected_component_list");
                component_selection_1.children[0].classList.toggle("selected_component_category");
                if(recipe_div.querySelectorAll(".folded_crafting_selection").item(0).lastChild 
                    && !is_element_above_x(recipe_div.querySelectorAll(".folded_crafting_selection").item(0).lastChild, document.getElementById("exit_crafting_button"))) 
                {
                    recipe_div.querySelectorAll(".folded_crafting_selection").item(0).lastChild.scrollIntoView({block: "end", inline: "nearest"});
                }
            }
        });
        component_selection_2.parentNode.children[1].addEventListener("click", (event)=>{
            //unfold a list for selection; its content already loaded by a different function
            if(event.target.classList.contains("crafting_selection")) {
                component_selection_2.children[1].classList.toggle("selected_component_list");
                component_selection_2.children[0].classList.toggle("selected_component_category");
                if(!is_element_above_x(recipe_div.querySelector(".recipe_creation_button"), document.getElementById("exit_crafting_button"))) {
                    recipe_div.querySelector(".recipe_creation_button").scrollIntoView({block: "end", inline: "nearest"});
                }
            }
        });

        const accept_recipe_button = document.createElement("div");
        accept_recipe_button.innerHTML = t("制作");
        accept_recipe_button.classList.add("recipe_creation_button");
        accept_recipe_button.addEventListener("click", (event)=>{
            window.useRecipe(event.target);
            //equipments
        });

        const equip_max_button = document.createElement("div");
        equip_max_button.innerHTML = t("[制作最大]")
        equip_max_button.classList.add("recipe_creation_button");
        equip_max_button.addEventListener("click", (event)=>{
            window.useRecipemax(event.target);
            //equipments
        });

        recipe_div.append(component_selections);
        recipe_div.append(accept_recipe_button);
        recipe_div.append(equip_max_button);
        
        accept_recipe_button.append(create_recipe_tooltip({category, subcategory, recipe_id, components: []}));
        equip_max_button.append(create_recipe_tooltip({category, subcategory, recipe_id, components: []}));
    } else {
        throw new Error(`No such crafting subcategory as "${subcategory}"`);
    }

    crafting_pages[category][subcategory].appendChild(recipe_div);
}

/**
 * updates all displayed recipes; 
 * needs to be called whenever something is crafted (in case some recipe became unavailable due to lack of materials) and/or whenever a crafting-related skill levels up
 */
function update_displayed_crafting_recipes() {
    Object.keys(recipes).forEach(recipe_category => {
        Object.keys(recipes[recipe_category]).forEach(recipe_subcategory => {
            Object.keys(recipes[recipe_category][recipe_subcategory]).forEach(recipe => {
                if(recipes[recipe_category][recipe_subcategory][recipe].is_unlocked){
                    update_displayed_crafting_recipe({category: recipe_category, subcategory: recipe_subcategory, recipe_id: recipe});
                }
            })
        })
    });
}

/**
 * updates description and display color, based on resource availability and skill lvl
 */
function update_displayed_crafting_recipe({category, subcategory, recipe_id}) {
    const recipe_div = crafting_pages[category][subcategory].querySelector(`[data-recipe_id="${recipe_id}"]`);
    const recipe = recipes[category][subcategory][recipe_id];
    if(subcategory.includes("items")) {
        if(recipe.get_availability()) {
            recipe_div.classList.remove("recipe_unavailable");
        } else {
            recipe_div.classList.add("recipe_unavailable");
        }
        update_recipe_tooltip({category, subcategory, recipe_id});
    } else if(subcategory === "components" || recipe.recipe_type === "component") {
        update_recipe_tooltip({category, subcategory, recipe_id});
    } else if(subcategory === "equipment") {
        //update_recipe_tooltip({category, subcategory, recipe_id, material: null, components: []});
        //shouldn't actually be needed as tooltip already updates when opening recipe and when selecting components
    } else {
        console.error(`No such crafting subcategory as "${subcategory}"`);
    }
}

/**
 * creates a tooltip for the >final result<
 */
function create_recipe_tooltip({category, subcategory, recipe_id, material, components}) {
    const recipe = recipes[category][subcategory][recipe_id];
    const tooltip = document.createElement("div");
    tooltip.classList.add("recipe_tooltip");
    if(subcategory.includes("items")) {
        tooltip.innerHTML = create_recipe_tooltip_content({category, subcategory, recipe_id});
        tooltip.classList.add(`${subcategory}_recipe_tooltip`);
    }else if(subcategory === "components" || recipe.recipe_type === "component") {
        if(!material) {
            throw new Error(`Component recipes require passing a material, but recipe "${category}" -> "${subcategory}" -> "${recipe_id}" had none!`);
        }
        tooltip.innerHTML = create_recipe_tooltip_content({category, subcategory, recipe_id, material});
        tooltip.classList.add("component_recipe_tooltip");
    } else if(subcategory === "equipment") {
        tooltip.innerHTML = create_recipe_tooltip_content({category, subcategory, recipe_id, material, components});
        tooltip.classList.add("equipment_recipe_tooltip");
    } else {
        console.error(`No such crafting subcategory as "${subcategory}"`);
    }
    return tooltip;
}

function update_item_recipe_tooltips() {
    Object.keys(recipes).forEach(recipe_category => {
        Object.keys(recipes[recipe_category]).forEach(recipe_subcategory => {
            if(recipe_subcategory.includes("items") ) {
                Object.keys(recipes[recipe_category][recipe_subcategory]).forEach(recipe => {
                    if(recipes[recipe_category][recipe_subcategory][recipe].is_unlocked){
                        update_recipe_tooltip({category: recipe_category, subcategory: recipe_subcategory, recipe_id: recipe});
                    }
                });
            }
        });
    });
}

function update_recipe_tooltip({category, subcategory, recipe_id, components}) {
    if((crafting_pages[category][subcategory].querySelector(`[data-recipe_id="${recipe_id}"]`) == null)) return;
    const tooltip = crafting_pages[category][subcategory].querySelector(`[data-recipe_id="${recipe_id}"]`).querySelector(`.${subcategory}_recipe_tooltip`);
    const recipe = recipes[category][subcategory][recipe_id];
    if(subcategory.includes("items")) {
        tooltip.innerHTML = create_recipe_tooltip_content({category, subcategory, recipe_id});
    } else if(subcategory === "components" || recipe.recipe_type === "component") {
        const material_selections_div = crafting_pages[category][subcategory].querySelector(`[data-recipe_id='${recipe_id}']`).children[1];
        for(let i = 0; i < material_selections_div.children.length; i++) {
            const material_key = material_selections_div.children[i].dataset.item_key;
            if(material_key == undefined) continue;
            const {id} = JSON.parse(material_key);
            const material_recipe = recipe.materials.filter(material => material.material_id === id);
            
            material_selections_div.children[i].children[1].innerHTML = create_recipe_tooltip_content({category, subcategory, recipe_id, material: material_recipe[0]});
            
        }
    } else if(subcategory === "equipment") {
        tooltip.innerHTML = create_recipe_tooltip_content({category, subcategory, recipe_id, components});
    } else {
        console.error(`No such crafting subcategory as "${subcategory}"`);
    }
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

/**
 * updates the list of selectable components for equipment crafting;
 * generally called for the recipe that was just used
 * component_keys is used for automatically selecting two comps
 */
function update_displayed_component_choice({category, recipe_id, component_keys = {}}) {
    const recipe_div = crafting_pages[category]["equipment"].querySelector(`[data-recipe_id="${recipe_id}"]`);
    const recipe = recipes[category]["equipment"][recipe_id];

    const component_selections_div = crafting_pages[category]["equipment"].querySelector(`[data-recipe_id='${recipe_id}']`).children[1].children;
    
    component_selections_div[0].children[1].innerHTML = "";
    component_selections_div[1].children[1].innerHTML = "";

    const components = [];
    components.push(Object.values(character.inventory).filter(item=>{
        return recipe.components[0] === item.item.component_type;
    }));

    components.push(Object.values(character.inventory).filter(item=>{
        return recipe.components[1] === item.item.component_type;
    }));

    for(let i = 0; i < 2; i++) {
        for(let j = 0; j < components[i].length; j++) {
            const item_div = document.createElement("div");
            item_div.innerHTML = t`<i class="material-icons icon selected_component_icon"> check </i>${components[i][j].item.name}, ${components[i][j].item.quality}%, x${components[i][j].count}`;
            item_div.classList.add("selectable_component");
            item_div.dataset.item_key = components[i][j].item.getInventoryKey();
            item_div.dataset.item_quality = components[i][j].item.quality;
            item_div.dataset.item_name = components[i][j].item.getName();
            item_div.dataset.component_tier = components[i][j].item.component_tier;
            item_div.appendChild(create_item_tooltip(components[i][j].item, {class_name: "recipe_tooltip"}));
            
            item_div.addEventListener("click", ()=>{
                toggle_exclusive_class({element: item_div, siblings_only: true, class_name: "selected_component"});
                const components = [];
                const component_1_key = recipe_div.children[1].children[0].children[1].querySelector(".selected_component")?.dataset.item_key;
                if(component_1_key) {
                    components.push(character.inventory[component_1_key]);
                }

                const component_2_key = recipe_div.children[1].children[1].children[1].querySelector(".selected_component")?.dataset.item_key;
                if(component_2_key) {
                    components.push(character.inventory[component_2_key]);
                }
                update_recipe_tooltip({category, subcategory: "equipment", recipe_id, components});
            });
                
            component_selections_div[i].children[1].appendChild(item_div);

            if(component_keys[item_div.dataset.item_key]) {
                item_div.click();
            }
        }
    }
    if(!is_element_above_x(recipe_div.querySelector(".recipe_creation_button"), document.getElementById("exit_crafting_button"))) {
        recipe_div.querySelector(".recipe_creation_button").scrollIntoView({block: "end", inline: "nearest"});
    }
    
    for(let i = 0; i < 2; i++) {
        [...component_selections_div[i].children[1].children].sort((a,b) => {
            if(Number.parseInt(a.dataset.component_tier) > Number.parseInt(b.dataset.component_tier)) {
                return -1;
            } else if (Number.parseInt(a.dataset.component_tier) < Number.parseInt(b.dataset.component_tier)) {
                return 1;
            } else if(a.dataset.item_name > b.dataset.item_name) {
                return 1;
            } else if(a.dataset.item_name < b.dataset.item_name) {
                return -1;
            } else if(Number.parseInt(a.dataset.item_quality) > Number.parseInt(b.dataset.item_quality)) {
                return -1;
            } else {
                return 1;
            }

        }).forEach(node=>component_selections_div[i].children[1].appendChild(node));
    }
}

/**
 * updates the list of selectable materials for component crafting;
 * displays only the materials available in inventory; those that are in too low number are grayed out and unselectable
 */
function update_displayed_material_choice({category, subcategory, recipe_id, refreshing}) {
    const recipe = recipes[category][subcategory][recipe_id];

    const material_selections_div = crafting_pages[category][subcategory].querySelector(`[data-recipe_id='${recipe_id}']`).children[1];
    
    material_selections_div.innerHTML = "";

    const materials = Object.values(character.inventory).filter(item=>{
        return recipe.materials.filter(material => material.material_id === item.item?.id).length > 0;
    });

    for(let i = 0; i < materials.length; i++) {
        const material_recipe = recipe.materials.filter(material => material.material_id === materials[i].item.id)[0];
        const item_div = document.createElement("div");
        item_div.innerHTML = t`<i class="material-icons icon selected_material_icon"> check </i>${item_templates[material_recipe.result_id].getDisplayName()}`;
        item_div.classList.add("selectable_material");
        item_div.dataset.item_key = materials[i].item.getInventoryKey();

        const recipe_max = document.createElement("span");
        recipe_max.classList.add("bigger_button");
        recipe_max.classList.add("recipe_10");
        recipe_max.innerText="[max]";
        if(material_recipe.count <= materials[i].count) {
            item_div.addEventListener("click", (event)=>{
                item_div.classList.add("selected_material");
                window.useRecipe(event.target.parentNode);
                item_div.classList.remove("selected_material"); //this is so stupid

                //comps
            });
            recipe_max.addEventListener("click", (event)=>{
                item_div.classList.add("selected_material");
                window.useRecipemax(event.target.parentNode);
                item_div.classList.remove("selected_material"); //this is so stupid
                //comps
            });
        } else {
            item_div.classList.add("recipe_unavailable");
        }

        item_div.append(create_recipe_tooltip({category, subcategory, recipe_id, material: material_recipe}));
        material_selections_div.appendChild(item_div);
        material_selections_div.appendChild(recipe_max);
    }
    if(!refreshing) {
        material_selections_div.lastChild?.scrollIntoView();
    }
}

function update_item_recipe_visibility() {
    Object.keys(recipes).forEach(recipe_category => {
        Object.keys(recipes[recipe_category]).forEach(recipe_subcategory => {
            if(!recipe_subcategory.includes("items")) {
                //no need to deal with other recipe types as they would be folded and will be reloaded on unfolding
                return;
            }
            Object.keys(recipes[recipe_category][recipe_subcategory]).forEach(recipe => {
                if(!recipes[recipe_category][recipe_subcategory][recipe].is_unlocked) {
                    return;
                }
                const recipe_div = crafting_pages[recipe_category][recipe_subcategory].querySelector(`[data-recipe_id="${recipe}"`);
                if(!recipes[recipe_category][recipe_subcategory][recipe].get_availability()) {
                    recipe_div.classList.add("recipe_unavailable");
                } else {
                    recipe_div.classList.remove("recipe_unavailable");
                }
            });
        })
    });
}

/**
 * 
 * @param {LocationActivity} location_activity 
 */
function create_gathering_tooltip(location_activity) {
    const gathering_tooltip = document.createElement("div");
    gathering_tooltip.id = "gathering_tooltip";
    gathering_tooltip.classList.add("job_tooltip");

    const {gathering_time_needed, gained_resources} = location_activity.getActivityEfficiency();

    let skill_names = "";
    for(let i = 0; i < activities[location_activity.activity_name].base_skills_names.length; i++) {
        skill_names += skills[activities[location_activity.activity_name].base_skills_names[i]].name();
    }

    if(location_activity.gained_resources.scales_with_skill) {
        gathering_tooltip.innerHTML = t`<span class="activity_efficiency_info">效率折算:<br>"${skill_names}" 技能等级 ${location_activity.gained_resources.skill_required[0]} 到 ${location_activity.gained_resources.skill_required[1]}</span><br><br>`;
    }

    gathering_tooltip.innerHTML += t`每 ${Math.round(gathering_time_needed)} 秒, 发现的机会:`;

    for(let i = 0; i < gained_resources.length; i++) {
        let chance = gained_resources[i].chance>0.01?Math.round(100*gained_resources[i].chance):"???";
        let count = gained_resources[i].count[0]===gained_resources[i].count[1]?gained_resources[i].count[0]:`${gained_resources[i].count[0]}-${gained_resources[i].count[1]}`;
        gathering_tooltip.innerHTML += t`<br>x${count} "${gained_resources[i].name}" (${chance}%)`;
    }

    if(location_activity.exp_scaling && location_activity.done_actions != 0 )
    {
        let exp_t = location_activity.done_actions;
        let exp_s = location_activity.exp_o;
        gathering_tooltip.innerHTML += t`<br><br><b><span style="color:red">收益递减:</span></b><br>因为已经进行的 ${exp_t} 次行动,<br> 消耗的时间 x ${format_number(Math.pow(exp_s,exp_t))}`;
    }

    

    return gathering_tooltip;
}

function update_gathering_tooltip(current_activity) {
    const gathering_tooltip = document.getElementById("gathering_tooltip");
    if(!gathering_tooltip) {
        return;
    }
    
    const {gathering_time_needed, gained_resources} = current_activity.getActivityEfficiency();

    let skill_names = "";
    for(let i = 0; i < activities[current_activity.activity_name].base_skills_names.length; i++) {
        skill_names += skills[activities[current_activity.activity_name].base_skills_names[i]].name();
    }

    if(current_activity.gained_resources.scales_with_skill) {
        gathering_tooltip.innerHTML = t`<span class="activity_efficiency_info">效率折算:<br>"${skill_names}" 技能等级 ${current_activity.gained_resources.skill_required[0]} 到 ${current_activity.gained_resources.skill_required[1]}</span><br><br>`;
    }
    gathering_tooltip.innerHTML += t`每 ${Math.round(gathering_time_needed)} 秒, 发现的机会:`;
    for(let i = 0; i < gained_resources.length; i++) {
        let count = gained_resources[i].count[0]===gained_resources[i].count[1]?gained_resources[i].count[0]:`${gained_resources[i].count[0]}-${gained_resources[i].count[1]}`;
        gathering_tooltip.innerHTML += t`<br>x${count} "${gained_resources[i].name}" (${Math.round(100*gained_resources[i].chance)}%)`;
    }
    if(current_activity.exp_scaling)
    {
        let exp_t = current_activity.done_actions;
        let exp_s = current_activity.exp_o;
        gathering_tooltip.innerHTML += t`<br><br><b><span style="color:red">收益递减:</span></b><br>因为已经进行的 ${exp_t} 次行动,<br> 消耗的时间 x ${format_number(Math.pow(exp_s,exp_t))}`;
    }
}

// update_displayed_health, update_displayed_stats and update_displayed_character_xp were replaced by
// the BasicInfo island (`src/islands/BasicInfo.vue`, `data-island="basic-info"`). `character` and
// `active_effects` are reactive, so the HP bar, XP bar and rank recompute on their own.


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
    const dialogue = dialogues[dialogue_key];
    
    clear_action_div();
    
    const dialogue_answer_div = document.createElement("div");
    dialogue_answer_div.id = "dialogue_answer_div";
    action_div.appendChild(dialogue_answer_div);
    Object.keys(dialogue.textlines).forEach(function(key) { //add buttons for textlines
            if(dialogue.textlines[key].is_unlocked && !dialogue.textlines[key].is_finished) { //do only if text_line is not unavailable
                if(dialogue.textlines[key].required_flags) {
                    if(dialogue.textlines[key].required_flags.yes && !Array.isArray(dialogue.textlines[key].required_flags.yes) || dialogue.textlines[key].required_flags.no && !Array.isArray(dialogue.textlines[key].required_flags.no)) {
                        console.error(`Textline "${key}" in dialogue "${dialogue_key}" has required flag passed as a single value but it should be an array!`)
                    }
                    if(dialogue.textlines[key].required_flags.yes) {
                        for(let i = 0; i < dialogue.textlines[key].required_flags.yes.length; i++) {
                            
                            if(!global_flags[dialogue.textlines[key].required_flags.yes[i]]) {
                                return;
                            }
                        }
                    }
                    if(dialogue.textlines[key].required_flags.no) {
                        for(let i = 0; i < dialogue.textlines[key].required_flags.no.length; i++) {
                            if(global_flags[dialogue.textlines[key].required_flags.no[i]]) {
                                return;
                            }
                        }
                    }
                }
                
                const textline_div = document.createElement("div");
                textline_div.innerHTML = t`"${t(dialogue.textlines[key].name)}"`;
                textline_div.classList.add("dialogue_textline");
                textline_div.setAttribute("data-textline", key);
                textline_div.setAttribute("onclick", `start_textline(this.getAttribute('data-textline'))`);
                action_div.appendChild(textline_div);
            }
    });
    //dialogue_answer_div.innerHTML = dialogue.textlines;

    if(dialogue.trader) {
        const trade_div = document.createElement("div");
        trade_div.innerHTML = t(traders[dialogue.trader].trade_text);
        trade_div.classList.add("dialogue_trade")
        trade_div.setAttribute("data-trader", dialogue.trader);
        trade_div.setAttribute("onclick", "startTrade(this.getAttribute('data-trader'))")
        action_div.appendChild(trade_div);
    }

    const end_dialogue_div = document.createElement("div");

    end_dialogue_div.innerHTML = t`<i class='material-icons'>arrow_back</i> ${dialogue.ending_text}`;
    end_dialogue_div.classList.add("end_dialogue_button");
    end_dialogue_div.setAttribute("onclick", "end_dialogue()");

    action_div.appendChild(end_dialogue_div);
}

function update_displayed_textline_answer(text) {
    document.getElementById("dialogue_answer_div").innerHTML = text;
    document.getElementById("dialogue_answer_div").style.padding = "10px";
}

function exit_displayed_trade() {
    action_div.style.display = "";
}

function start_activity_display(current_activity) {
    clear_action_div();
    const action_status_div = document.createElement("div");
    action_status_div.innerText = t(activities[current_activity.activity_name].action_text);
    action_status_div.id = "action_status_div";
    const action_xp_div = document.createElement("div");

    if(activities[current_activity.activity_name].base_skills_names) {
        const needed_xp = skills[activities[current_activity.activity_name].base_skills_names].current_level == skills[activities[current_activity.activity_name].base_skills_names].max_level? "Max": `${Math.round(10000*skills[activities[current_activity.activity_name].base_skills_names].current_xp/skills[activities[current_activity.activity_name].base_skills_names].xp_to_next_lvl)/100}%`
        if(activities[current_activity.activity_name].type !== "GATHERING") {
            action_xp_div.innerText = t`每秒得到 ${current_activity.skill_xp_per_tick} ${skills[activities[current_activity.activity_name].base_skills_names].name()} 基础经验值   (${needed_xp})`;
        } else {
            action_xp_div.innerText = t`得到 ${current_activity.skill_xp_per_tick} 基本经验 每个采集循环 对于 ${skills[activities[current_activity.activity_name].base_skills_names].name()} (${needed_xp})`;
        }
    }
    else {
        console.warn(`Activity "${current_activity.activity_name}" has no skills assigned!`);
    }


    action_xp_div.id = "action_xp_div";

    const action_end_div = document.createElement("div");
    action_end_div.setAttribute("onclick", "end_activity()");
    action_end_div.id = "action_end_div";


    const action_end_text = document.createElement("div");
    const ActivityNameMap = {"Running":"跑步","Swimming":"游泳","mining":"挖掘","woodcutting":"砍伐","fishing":"钓鱼","AquaElement":"水元素感应"};
    const dev_ACNMap = false;
    action_end_text.innerText = t`结束 ${dev_ACNMap?current_activity.activity_name:ActivityNameMap[current_activity.activity_name]}`;
    action_end_text.id = "action_end_text";


    action_end_div.appendChild(action_end_text);

    if(activities[current_activity.activity_name].type === "JOB") {
        const action_end_earnings = document.createElement("div");
        action_end_earnings.innerHTML = t`(earnings: ${format_money(0)})`;
        action_end_earnings.id = "action_end_earnings";

        action_end_div.appendChild(action_end_earnings);
    }

    action_div.appendChild(action_status_div);
    action_div.appendChild(action_xp_div);

    if(current_activity.gained_resources) {
        const action_progress_bar_max = document.createElement("div");
        const action_progress_bar = document.createElement("div");
        action_progress_bar_max.appendChild(action_progress_bar);
        action_progress_bar.id = "gathering_progress_bar";
        action_progress_bar.style.width = 385*current_activity.gathering_time/current_activity.gathering_time_needed+"px";
        action_progress_bar_max.id = "gathering_progress_bar_max";
        action_div.appendChild(action_progress_bar_max);
        action_progress_bar_max.appendChild(create_gathering_tooltip(current_activity));
    }
    
    action_div.appendChild(action_end_div);

    if(activities[current_activity.activity_name].type === "JOB") 
    {
        const time_info_div = document.createElement("div");
        time_info_div.id = "time_for_earnings_div";

        if(!enough_time_for_earnings(current_activity)) {
            time_info_div.innerHTML = t`There's not enough time left to earn more, but ${character.name} might still learn something...`;
        }
        else {
            time_info_div.innerHTML = t`Next earnings in: ${format_time({time: {minutes: current_activity.working_period - current_activity.working_time}})}`;
        }
        action_div.insertBefore(time_info_div, action_div.children[2]);
    }

    start_activity_animation();
}

function update_displayed_ongoing_activity(current_activity, is_job){
    if(is_job) {
        document.getElementById("action_end_earnings").innerHTML = t`(earnings: ${format_money(current_activity.earnings)})`
        const time_info_div = document.getElementById("time_for_earnings_div");
        
        if(!enough_time_for_earnings(current_activity)) {
            time_info_div.innerHTML = t`There's not enough time left to earn more, but ${character.name} might still learn something...`;
        } else {
            time_info_div.innerHTML = t`Next earnings in: ${format_time({time: {minutes: current_activity.working_period - current_activity.working_time%current_activity.working_period}})}`;
        }
    }
    const action_xp_div = document.getElementById("action_xp_div");
    const needed_xp = skills[activities[current_activity.activity_name].base_skills_names].current_level == skills[activities[current_activity.activity_name].base_skills_names].max_level? "Max": `${Math.round(10000*skills[activities[current_activity.activity_name].base_skills_names].current_xp/skills[activities[current_activity.activity_name].base_skills_names].xp_to_next_lvl)/100}%`
    if(activities[current_activity.activity_name].type !== "GATHERING") {
        action_xp_div.innerText = t`每秒获取 ${format_number(current_activity.skill_xp_per_tick*get_skills_overall_xp_gain())}  ${skills[activities[current_activity.activity_name].base_skills_names].name()} 经验值 (${needed_xp})`;
    } else {
        action_xp_div.innerText = t`得到 ${current_activity.skill_xp_per_tick} 基本经验 每个采集循环 对于 ${skills[activities[current_activity.activity_name].base_skills_names].name()} (${needed_xp})`;
    }
    if(current_activity.spec != ""){
        if(current_activity.spec == "goto2-5")
        {
            inf_combat.A7 = inf_combat.A7 || {cur:0}; 
            if(inf_combat.A7.cur >= 3.2e6){
                unlock_location(locations["声律城废墟"],true);
                action_xp_div.innerHTML += "<br>目的地 已抵达.(从[纳家秘境]出发)"   
            }
            else{
                action_xp_div.innerHTML += "<br>前往声律城..."   
                let speed = Math.pow(character.stats.full.agility,0.5)/10;
                action_xp_div.innerHTML += `<br>基础速度: ${format_number(speed)} m / s.`   
                speed *= Math.pow(1.1,skills["Running"].current_level);
                action_xp_div.innerHTML += `<br>速度: ${format_number(speed)} m / s. <br>(跑步 lv.${skills["Running"].current_level}, + ${format_number(Math.pow(1.1,skills["Running"].current_level)*100-100)}%)`;  
                
                action_xp_div.innerHTML += `<br>时间流速: 36000 s / s.`   
                action_xp_div.innerHTML += `<br>最终速度: ${format_number(speed*36)} km / s.`
                action_xp_div.innerHTML += `<br>剩余距离：${Math.round(3.2e6 - inf_combat.A7.cur).toLocaleString('en-US')} / 3,200,000 km.`; 
                inf_combat.A7.cur += speed*36;
                current_game_time.go_up(594);
            }
            
        }
    }
    if(current_activity.gained_resources) {
        document.getElementById("gathering_progress_bar").style.width = 385*current_activity.gathering_time/current_activity.gathering_time_needed+"px";
    }
}

function start_sleeping_display(){
    clear_action_div();

    const action_status_div = document.createElement("div");
    action_status_div.innerText = t("睡觉...");
    action_status_div.id = "action_status_div";

    const action_end_div = document.createElement("div");
    action_end_div.setAttribute("onclick", "end_sleeping()");
    action_end_div.id = "action_end_div";


    const action_end_text = document.createElement("div");
    action_end_text.innerText = t("起床");
    action_end_text.id = "action_end_text";

    
    action_end_div.appendChild(action_end_text);

    action_div.appendChild(action_status_div);
    action_div.appendChild(action_end_div);
    start_activity_animation();
}

function start_reading_display(title) {
    clear_action_div();

    const action_status_div = document.createElement("div");
    action_status_div.innerText = `Reading the book, ${format_reading_time(item_templates[title].getRemainingTime())} left`;
    action_status_div.id = "action_status_div";

    const action_end_div = document.createElement("div");
    action_end_div.setAttribute("onclick", "end_reading()");
    action_end_div.id = "action_end_div";


    const action_end_text = document.createElement("div");
    action_end_text.innerText = `Stop reading for now`;
    action_end_text.id = "action_end_text";

    action_end_div.appendChild(action_end_text);

    action_div.appendChild(action_status_div);
    action_div.appendChild(action_end_div);
    start_activity_animation({book_title: title});
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

];
//超过25倍倍率的攻击暂时视为必中！
function format_perc(perc){
    if(perc < 10) return format_number(100*perc) + '%';
    else return format_number(perc) + 'x'; 
}

function format_numberL(perc){
    if(perc < 1e-6) return format_number(10000*perc) + '/亿';
    else if(perc < 0.001) return format_number(10000*perc) + '‱';
    else if(perc < 10) return format_number(100*perc) + '%';
    else return format_number(perc) + 'x'; 
}

/** replaced by the Bestiary island (`src/islands/Bestiary.vue`, `data-island="bestiary"`)
 * keep missing-template killcount nulling; paint lives in the island
 */
function create_new_bestiary_entry(enemy_name) {
    const enemy = enemy_templates[enemy_name];
    if(enemy == undefined){
        enemy_killcount[enemy_name] = null;
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

/**
 * Toggles a specificed class for target 'element', removing it from any other element that might have had it.
 * If 'siblings_only' is true, class will be removed only from siblings
 * @param {Object} params
 * @param {HTMLElement} params.element
 * @param {Boolean} [params.siblings_only]
 * @param {String} params.class_name
 */
function toggle_exclusive_class({element, siblings_only=false, class_name}) {
    const elems = siblings_only?element.parentNode.querySelectorAll(`.${class_name}`):document.getElementsByClassName(class_name);
    const has_class = element.classList.contains(class_name);
    for(let i = 0; i < elems.length; i++) {
        elems[i].classList.remove(class_name);
    }

    if(!has_class) {
        element.classList.add(class_name);
    }
}

function is_element_above_x(element, x) {
    const rect = element.getBoundingClientRect();
    const rect2 = x.getBoundingClientRect();

    return rect.bottom <= rect2.top;
}

export {
    location_panel,
    start_activity_animation,
    end_activity_animation,
    update_displayed_trader,
    update_displayed_trader_inventory,
    update_displayed_character_inventory,
    sort_displayed_inventory,
    create_item_tooltip,
    update_displayed_money,
    log_message,
    messages,
    format_number,
    clear_action_div,
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
    update_displayed_ongoing_activity,
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
    update_gathering_tooltip,
    update_displayed_location_types,
    open_crafting_window,
    close_crafting_window,
    switch_crafting_recipes_page,
    switch_crafting_recipes_subpage,
    create_displayed_crafting_recipes,
    update_displayed_component_choice,
    update_displayed_material_choice,
    update_recipe_tooltip,
    update_displayed_crafting_recipes,
    update_item_recipe_visibility,
    update_item_recipe_tooltips,
    update_displayed_book,
    update_other_save_load_button,
    unlock_moonwheel,
    update_displayed_family,
    update_displayed_family_members,
    format_numberL,
    spec_stat,
};
