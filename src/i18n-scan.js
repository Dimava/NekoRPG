/**
 * English-page leftover scanner. No-ops without NekoRPGTranslations.
 * Every 1s walks the live DOM for Han text and logs what / where.
 * Disable with localStorage.i18n_scan = "0".
 */
"use strict";

const HAN = /[\u3400-\u9fff]/;
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);
const ATTRS = ["title", "placeholder", "alt", "value"];
const INTERVAL_MS = 1_000;

function enabled() {
    if (!globalThis.NekoRPGTranslations) return false;
    return localStorage.getItem("i18n_scan") !== "0";
}

function compact(text) {
    return String(text).replace(/\s+/g, " ").trim();
}

function skeleton(text) {
    return compact(text).replace(/[0-9]+(?:\.[0-9]+)?/g, "{{}}");
}

function nearest_id(el) {
    while (el && el !== document.body) {
        if (el.id) return `#${el.id}`;
        el = el.parentElement;
    }
    return "body";
}

function css_path(el) {
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.documentElement) {
        if (el.id) {
            parts.unshift(`#${el.id}`);
            break;
        }
        const cls = [...el.classList].slice(0, 2).map(name => `.${name}`).join("");
        let sel = el.tagName.toLowerCase() + cls;
        const parent = el.parentElement;
        if (parent) {
            const same = [...parent.children].filter(child => child.tagName === el.tagName);
            if (same.length > 1) sel += `:nth-of-type(${same.indexOf(el) + 1})`;
        }
        parts.unshift(sel);
        el = parent;
    }
    return parts.join(" > ");
}

function on_screen(rect) {
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    return rect.bottom > 0 && rect.right > 0 && rect.top < vh && rect.left < vw;
}

function node_rect(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getBoundingClientRect();
    }
    return node.getBoundingClientRect();
}

function add_hit(hits, el, text, attr, rect) {
    const value = compact(text);
    if (!value || !HAN.test(value) || !on_screen(rect ?? el.getBoundingClientRect())) return;
    hits.push({
        panel: nearest_id(el),
        where: css_path(el) + (attr ? `@${attr}` : ""),
        text: value,
        key: skeleton(value),
    });
}

function scan() {
    const hits = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentElement;
            if (!parent || SKIP.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
            return HAN.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
    });
    while (walker.nextNode()) {
        const node = walker.currentNode;
        add_hit(hits, node.parentElement, node.nodeValue, undefined, node_rect(node));
    }

    for (const el of document.body.querySelectorAll("*")) {
        if (SKIP.has(el.tagName)) continue;
        const rect = el.getBoundingClientRect();
        if (!on_screen(rect)) continue;
        for (const attr of ATTRS) {
            if (!el.hasAttribute(attr)) continue;
            add_hit(hits, el, el.getAttribute(attr), attr, rect);
        }
    }
    return hits;
}

function report(hits) {
    const grouped = new Map();
    for (const hit of hits) {
        const id = `${hit.panel}\t${hit.key}`;
        const group = grouped.get(id);
        if (group) {
            group.count += 1;
            if (group.where.length < 4 && !group.where.includes(hit.where)) group.where.push(hit.where);
        } else {
            grouped.set(id, { panel: hit.panel, text: hit.text, key: hit.key, count: 1, where: [hit.where] });
        }
    }
    const rows = [...grouped.values()].sort((a, b) => a.panel.localeCompare(b.panel) || b.count - a.count);
    console.groupCollapsed(`[i18n-scan] ${hits.length} leftover nodes, ${rows.length} kinds`);
    console.table(rows.map(row => ({
        n: row.count,
        panel: row.panel,
        text: row.text,
        where: row.where.join(" | "),
    })));
    for (const row of rows) {
        console.log(`%c${row.panel}%c ×${row.count}\n${row.text}\n${row.where[0]}`, "color:#8cf", "color:inherit");
    }
    console.groupEnd();
}

function start() {
    if (!enabled()) return;
    const run = () => {
        if (!enabled()) return;
        try {
            report(scan());
        } catch (error) {
            console.warn("[i18n-scan]", error);
        }
    };
    setTimeout(run, 1000);
    setInterval(run, INTERVAL_MS);
}

start();
