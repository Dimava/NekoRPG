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

function get_template_index() {
    if(template_index) return template_index;
    template_index = new Map();
    const catalog = globalThis.NekoRPGTranslations;
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

function translate_template(strings, values) {
    const parts = get_template_index().get(strings.join(PLACEHOLDER)) ?? strings;
    let result = parts[0];
    for(let i = 0; i < values.length; i++) result += t(values[i]) + parts[i + 1];
    return result;
}

function t(value, ...values) {
    if(Array.isArray(value) && value.raw) return translate_template(value, values);
    if(typeof value !== "string") return value;
    return globalThis.NekoRPGTranslations?.[value] ?? value;
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
    if(!scale.units_en || !globalThis.NekoRPGTranslations) return scale;
    scale.english = scale.english || {group: scale.group, units: scale.units_en};
    return scale.english;
}

export { t, number_scale, set_number_units };
