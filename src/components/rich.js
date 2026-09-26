// Display text as data for Rich.vue.
//
// Game text arrives in two shapes:
//  - authored strings (descriptions, dialogue, log lines) that carry a little
//    inline markup: <br>, <b>, <span class=realm_sky>, <img src=...>
//  - display parts built by code: [text, {money: n}, {text, cls, b}, ...],
//    usually from tx`...`
// to_nodes turns either into a tree of {tag, cls, style, src, children} and
// strings. Markup is parsed against a whitelist and never reaches innerHTML:
// unknown tags keep their children and lose the tag, attributes other than
// class, style and src are dropped.

const TAGS = { b: 'b', strong: 'b', i: 'i', em: 'i', u: 'u', del: 'del', s: 'del', span: 'span', div: 'div', p: 'div', small: 'small', sup: 'sup', sub: 'sub', br: 'br', img: 'img' }
const VOID = new Set(['br', 'img'])
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', emsp: ' ', ensp: ' ', thinsp: ' ' }
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g
const ATTR = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g

const decode = s => s.includes('&')
  ? s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
      e[0] !== '#' ? ENTITIES[e.toLowerCase()] ?? m
        : String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)))
  : s

const cache = new Map()

/** Parse authored markup. Results are cached and must not be mutated. */
export function parse_markup(src) {
  if (!src.includes('<') && !src.includes('&')) return [src]
  let nodes = cache.get(src)
  if (nodes) return nodes
  const root = { children: [] }
  const stack = [root]
  let last = 0
  for (const m of src.matchAll(TAG)) {
    if (m.index > last) stack.at(-1).children.push(decode(src.slice(last, m.index)))
    last = m.index + m[0].length
    const [, closing, raw_name, raw_attrs] = m
    const name = raw_name.toLowerCase()
    const tag = TAGS[name]
    if (closing) {
      // close the nearest open element with that name, and anything left open inside it
      const at = stack.findLastIndex((n, i) => i > 0 && n.name === name)
      if (at > 0) stack.length = at
      continue
    }
    const node = { tag, name, children: [] }
    for (const [, key, a, b, c] of raw_attrs.matchAll(ATTR)) {
      const value = decode(a ?? b ?? c ?? '')
      if (key === 'class') node.cls = value
      else if (key === 'style') node.style = value
      else if (key === 'src') node.src = value
    }
    if (!tag) {
      // unknown element: keep what is inside it, drop the element itself
      if (!VOID.has(name)) stack.push({ name, children: stack.at(-1).children, transparent: true })
      continue
    }
    stack.at(-1).children.push(node)
    if (!VOID.has(tag)) stack.push(node)
  }
  if (last < src.length) stack.at(-1).children.push(decode(src.slice(last)))
  nodes = root.children
  if (cache.size > 5000) cache.clear()
  cache.set(src, nodes)
  return nodes
}

/**
 * Normalize anything displayable into nodes:
 *   string              authored text, may contain markup
 *   number              shown as is
 *   array               concatenation
 *   {money: n}          coins, rendered by Money.vue
 *   {text, cls, b, style}  one styled run of plain text
 *   {rich, cls, b, style}  one styled run of anything above
 *   {br: true}
 */
export function to_nodes(value) {
  if (value == null || value === false || value === '') return []
  if (typeof value === 'string') return parse_markup(value)
  if (typeof value === 'number') return [String(value)]
  if (Array.isArray(value)) return value.flatMap(to_nodes)
  if (value.tag) return [value]
  if (value.br) return [{ tag: 'br' }]
  if ('money' in value) return [{ tag: 'money', value: value.money }]
  const children = 'text' in value ? [String(value.text)] : to_nodes(value.rich)
  if (!value.cls && !value.b && !value.style) return children
  return [{ tag: value.b ? 'b' : 'span', cls: value.cls, style: value.style, children }]
}
