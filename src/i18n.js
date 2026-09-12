/**
 * Translate text at a display boundary.
 *
 * The generated English page loads NekoRPGTranslations before the game module.
 * The Chinese page does not, so the original value is returned unchanged.
 *
 * Two call forms:
 *   t(value)      looks up a whole string.
 *   t`a ${x} b`   looks up the literal skeleton as `a {{}} b` and translates
 *                 each interpolated value in its own right, so a sentence and
 *                 the names it mentions are separate catalog entries.
 *
 * Placeholders are matched by position, not by name: a catalog entry may write
 * them as `{{}}` or, for the entries extracted from source text, as the
 * original `${expression}`. Both reduce to the same lookup, so renaming a
 * variable in a template does not invalidate its translation. Prefer `{{}}`
 * when writing new entries by hand.
 *
 * The template form keys on the cooked strings rather than strings.raw: no
 * catalog key contains a backslash escape, so the two agree, and Bun escapes
 * non-ASCII in raw where browsers do not.
 */

import { reactive } from "@vue/reactivity";

const PLACEHOLDER = "{{}}";

// Splits a catalog entry into its literal parts. `${...}` tracks brace depth so
// that an expression containing braces of its own does not end the placeholder
// early. Only the empty `{{}}` is a placeholder; the glossary's `{{中文|English}}`
// references are resolved before they reach the catalog.
function split_placeholders(text) {
    const parts = [];
    let literal = "";
    for(let i = 0; i < text.length; i++) {
        if(text.startsWith(PLACEHOLDER, i)) {
            parts.push(literal);
            literal = "";
            i += PLACEHOLDER.length - 1;
            continue;
        }
        if(text[i] === "$" && text[i + 1] === "{") {
            let depth = 1;
            let j = i + 2;
            while(j < text.length && depth > 0) {
                if(text[j] === "{") depth++;
                else if(text[j] === "}") depth--;
                j++;
            }
            if(depth > 0) break; //unterminated, treat the rest as literal
            parts.push(literal);
            literal = "";
            i = j - 1;
            continue;
        }
        literal += text[i];
    }
    parts.push(literal);
    return parts;
}

let template_index;
let term_index;
let catalog = globalThis.NekoRPGTranslations ?? null;

function get_template_index() {
    if(template_index) return template_index;
    template_index = new Map();
    if(!catalog) return template_index;
    //A template can be spelled either way, so the same lookup may be reachable
    //from two entries. The hand-written `{{}}` one is canonical and is applied
    //second, replacing whatever the historical `${expression}` entry said.
    const keys = Object.keys(catalog);
    for(const key of [...keys.filter(key => !key.includes(PLACEHOLDER)), ...keys.filter(key => key.includes(PLACEHOLDER))]) {
        const value = catalog[key];
        if(typeof value !== "string" || value === key) continue;
        const key_parts = split_placeholders(key);
        const value_parts = split_placeholders(value);
        //Placeholders are re-inserted in source order, so a translation that
        //dropped or reordered them cannot be filled in safely.
        if(key_parts.length !== value_parts.length) continue;
        template_index.set(key_parts.join(PLACEHOLDER), value_parts);
    }
    return template_index;
}

function get_term_index() {
    if(term_index) return term_index;
    term_index = new Map();
    if(!catalog) return term_index;
    for(const [key, value] of Object.entries(catalog)) {
        if(typeof value !== "string" || value === key) continue;
        if(key.includes(PLACEHOLDER) || key.includes("<") || key.includes("\n")) continue;
        if(!HAN.test(key) || HAN.test(value)) continue;
        const first = key[0];
        const bucket = term_index.get(first);
        if(bucket) bucket.push([key, value]);
        else term_index.set(first, [[key, value]]);
    }
    for(const bucket of term_index.values()) bucket.sort((a, b) => b[0].length - a[0].length);
    return term_index;
}

function substitute_known(text) {
    const index = get_term_index();
    let result = "";
    let replaced = false;
    for(let i = 0; i < text.length;) {
        const bucket = index.get(text[i]);
        let hit = null;
        if(bucket) {
            for(const [key, value] of bucket) {
                if(text.startsWith(key, i)) {
                    hit = value;
                    i += key.length;
                    replaced = true;
                    break;
                }
            }
        }
        if(hit != null) result += hit;
        else result += text[i++];
    }
    return replaced ? result : text;
}

const HAN = /[\u3400-\u9fff]/;
const missing_logged = new Set();

function warn_missing(key) {
    if(!HAN.test(key) || missing_logged.has(key)) return;
    missing_logged.add(key);
    console.warn(`[i18n] missing: ${key}`);
}

function translate_template(strings, values) {
    current_lang();
    const key = strings.join(PLACEHOLDER);
    const found = english() ? get_template_index().get(key) : null;
    if(english() && found == null) warn_missing(key);
    const parts = found ?? strings;
    let result = parts[0];
    for(let i = 0; i < values.length; i++) result += t(values[i]) + parts[i + 1];
    return result;
}

function t(value, ...values) {
    if(Array.isArray(value) && value.raw) return translate_template(value, values);
    if(typeof value !== "string") return value;
    if(!english()) return value;
    const translated = catalog[value];
    if(translated !== undefined) return translated;
    const substituted = substitute_known(value);
    if(substituted !== value) {
        if(HAN.test(substituted)) warn_missing(value);
        return substituted;
    }
    warn_missing(value);
    return value;
}

//Large numbers group by ten thousand here and by a thousand in KMBT, so the
//grouping is the one piece of display text a catalog lookup cannot express.
//The unit names are romanised here rather than in the catalog: several of them
//are ordinary characters (极, 正) that would then be substituted into any
//sentence that happens to contain the word.
const number_scales = {
    myriad: {
        group: 4,
        units: ["", "万", "亿", "兆", "京", "垓", "秭", "穣", "沟", "涛", "正", "载", "极"],
        units_en: ["", "W", "Y", "Z", "J", "G", "Zi", "R", "Gu", "Ji", "Zh", "Za", "Jx"],
    },
    kmbt: {group: 3, units: ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Ud"]},
};

let use_kmbt_units = false;

function set_number_units(kmbt) {
    use_kmbt_units = !!kmbt;
}

function number_scale() {
    const scale = use_kmbt_units ? number_scales.kmbt : number_scales.myriad;
    if(!scale.units_en || !english()) return scale;
    scale.english = scale.english || {group: scale.group, units: scale.units_en};
    return scale.english;
}


const LANG_KEY = "neko-rpg-lang";
const forced_en = document.documentElement.lang === "en";

function stored_lang() {
    const stored = localStorage.getItem(LANG_KEY);
    if(stored === "en" || stored === "zh") return stored;
    return "zh";
}

const i18n_state = reactive({
    lang: forced_en ? "en" : stored_lang(),
    rev: 0,
});

function current_lang() {
    i18n_state.rev;
    return i18n_state.lang;
}

function english() {
    return current_lang() === "en" && !!catalog;
}

async function load_catalog() {
    if(catalog) return;
    const res = await fetch(new URL("../translations/en.full.json", import.meta.url));
    catalog = await res.json();
    globalThis.NekoRPGTranslations = catalog;
    template_index = undefined;
    term_index = undefined;
    i18n_state.rev++;
}

async function set_lang(lang) {
    if(lang !== "en" && lang !== "zh") return;
    localStorage.setItem(LANG_KEY, lang);
    if(forced_en) return;
    if(lang === "en") await load_catalog();
    i18n_state.lang = lang;
}

if(i18n_state.lang === "en") load_catalog();

export { t, number_scale, set_number_units, current_lang, set_lang, forced_en };

if (globalThis.NekoRPGTranslations) import("./i18n-scan.js");
