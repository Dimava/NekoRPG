import { resolve, relative, isAbsolute } from 'node:path'

const slash = value => value.replaceAll('\\', '/')
const within = (parent, file) => {
  const rel = relative(parent, file)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Opt-in bundling. All other local modules stay external, including transitive imports. */
export function internalBoundary({ internals, imports, outDir, importMap }) {
  const roots = internals.map(path => resolve(path))
  const plumbing = ['src/boot.js', 'plugin/mount.js'].map(path => resolve(path))
  const aliases = new Map(Object.entries(imports).map(([name, e]) => [resolve(e.source), name]))
  return {
    name: 'opt-in-internals',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (source === 'vue' || source === '@vue/reactivity') return { id: source, external: true }
      // Virtual modules (Uno, Vite, compiler helpers) belong to the toolchain.
      if (source.startsWith('\0') || source === 'uno.css') return
      if (source in imports) {
        const file = resolve(imports[source].source)
        if (roots.some(root => within(root, file))) {
          throw new Error(`Import-map alias ${source} points inside internals`)
        }
        return { id: source, external: true }
      }
      const result = await this.resolve(source, importer, { skipSelf: true })
      if (!result || result.external || result.id.startsWith('\0')) return result
      const [filename, query] = result.id.split('?')
      if (!isAbsolute(filename)) return result // toolchain virtual identifier
      const file = resolve(filename)
      if (plumbing.includes(file) || roots.some(root => within(root, file))) return result
      if (query) throw new Error(`External asset queries are not supported: ${source}`)
      if (slash(file).includes('/node_modules/')) {
        throw new Error(`Dependency ${source} is not internal. Add its directory to internals or a browser import-map alias.`)
      }
      if (!/\.m?js$/.test(file)) {
        throw new Error(`External file must be browser JS: ${file}. Add its directory to internals to compile it.`)
      }
      const name = aliases.get(file)
      if (!name) {
        const local = slash(relative(process.cwd(), file))
        throw new Error(`External module ${local} is not in islands.config.js imports`)
      }
      return { id: name, external: true }
    },
  }
}
