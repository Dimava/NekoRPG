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
    for(const key of Object.keys(catalog)) {
        if(!key.includes("${") && !key.includes(PLACEHOLDER)) continue;
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

export { t };
