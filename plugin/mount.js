import { createVaporApp } from 'vue'

const kebab = s => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

// decl may be Type, [Type, ...], or { type: Type | [Type, ...] }
function coerce(decl, value) {
  const types = [].concat((decl && decl.type) ?? decl ?? [])
  // Ambiguous unions stay strings. Use data-props JSON for explicit types.
  if (types.length !== 1) return value
  if (types[0] === Number) {
    const n = Number(value)
    if (!value.trim() || !Number.isFinite(n)) throw new TypeError(`Invalid number: ${value}`)
    return n
  }
  if (types[0] === Boolean) {
    if (['', 'true', '1'].includes(value)) return true
    if (['false', '0'].includes(value)) return false
    throw new TypeError(`Invalid boolean: ${value}`)
  }
  return value
}

export function propsFor(component, el) {
  const { island, mounted, islandError, props: json, ...raw } = el.dataset
  const props = {}
  const decls = component.props
  for (const [key, value] of Object.entries(raw)) {
    props[key] = decls && !Array.isArray(decls) ? coerce(decls[key], value) : value
  }
  if (json) {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new TypeError('data-props must be a JSON object')
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new TypeError('Unsafe prop key')
      props[key] = value
    }
  }
  return props
}

/**
 * Mount every `[data-island]` element from a glob of island components:
 *
 *   mountIslands(import.meta.glob('./islands/*.vue', { eager: true }))
 *
 * `src/islands/StatBars.vue` answers to `data-island="stat-bars"`.
 * `data-*` attributes become props, coerced by the component's own props
 * declaration; `data-props='{...}'` merges raw JSON on top.
 */
export function mountIslands(modules, root = document) {
  const registry = Object.create(null)
  for (const [path, mod] of Object.entries(modules)) {
    const name = kebab(path.split('/').pop().replace(/\.vue$/, ''))
    if (registry[name]) throw new Error(`Duplicate island name: ${name}`)
    registry[name] = mod.default
  }
  for (const el of root.querySelectorAll('[data-island]')) {
    if (el.dataset.mounted) continue
    const name = el.dataset.island
    const component = registry[name]
    if (!component) {
      console.warn(`[islands] unknown island "${name}"`, el)
      continue
    }
    try {
      const app = createVaporApp(component, propsFor(component, el))
      let failed = false
      app.config.errorHandler = error => {
        failed = true
        el.dataset.islandError = 'true'
        console.error(`[islands] error in "${name}"`, error)
      }
      app.mount(el)
      if (!failed) {
        delete el.dataset.islandError
        el.dataset.mounted = 'true'
      }
    } catch (e) {
      el.dataset.islandError = 'true'
      console.error(`[islands] failed to mount "${name}"`, e)
    }
  }
}
