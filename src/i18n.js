/**
 * Translate text at a display boundary.
 *
 * The generated English page loads NekoRPGTranslations before the game module.
 * The Chinese page does not, so the original value is returned unchanged.
 */
function t(value) {
    if(typeof value !== "string") return value;
    return globalThis.NekoRPGTranslations?.[value] ?? value;
}

export { t };
