import { parse } from "acorn";
import * as parse5 from "parse5";

export const han = /[\u3400-\u9fff]/;

export function collectJs(source: string) {
  const values = new Map<string, string>();
  const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" }) as any;

  function walk(node: any, path: string) {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "Literal" && typeof node.value === "string") values.set(path, node.value);
    if (node.type === "TemplateLiteral") values.set(path, source.slice(node.start + 1, node.end - 1));

    for (const [key, child] of Object.entries(node)) {
      if (["start", "end", "loc", "range"].includes(key)) continue;
      if (Array.isArray(child)) {
        child.forEach((item, index) => walk(item, `${path}.${key}[${index}]`));
      } else {
        walk(child, `${path}.${key}`);
      }
    }
  }

  walk(ast, "root");
  return values;
}

export function collectHtml(source: string) {
  const values = new Map<string, string>();
  const document = parse5.parse(source) as any;
  const translatedAttributes = new Set(["title", "placeholder", "value", "alt"]);

  function walk(node: any, path: string) {
    if (node.nodeName === "#text") {
      const value = node.value.trim();
      if (value) values.set(`${path}.text`, value);
      return;
    }
    if (node.nodeName === "script" || node.nodeName === "style") return;
    for (const attribute of node.attrs ?? []) {
      if (translatedAttributes.has(attribute.name)) {
        values.set(`${path}.attr.${attribute.name}`, attribute.value);
      }
    }
    (node.childNodes ?? []).forEach((child: any, index: number) => {
      walk(child, `${path}.${child.nodeName}[${index}]`);
    });
  }

  walk(document, "root");
  return values;
}
