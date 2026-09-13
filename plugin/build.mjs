// Build only the opt-in Vapor UI directories. Existing game modules stay
// external and continue to be served directly by the browser.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import { internalBoundary } from './boundary.js'
import { outDir, defines, imports, internals, runtimeExports, hostImportMap } from '../islands.config.js'

const readable = { minify: false, cssMinify: false, reportCompressedSize: false }
const kebab = value => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

function assertSingleVueCopy() {
  const roots = ['vue', ...readdirSync('node_modules/@vue').map(dir => `@vue/${dir}`)]
  const nested = roots
    .map(pkg => `node_modules/${pkg}/node_modules/@vue`)
    .filter(existsSync)
  if (nested.length) throw new Error(`Duplicate @vue packages installed under:\n  ${nested.join('\n  ')}`)

  const version = JSON.parse(readFileSync('node_modules/vue/package.json', 'utf8')).version
  for (const pkg of roots) {
    const packageFile = `node_modules/${pkg}/package.json`
    const packageVersion = JSON.parse(readFileSync(packageFile, 'utf8')).version
    if (packageVersion !== version) throw new Error(`${pkg}@${packageVersion} does not match vue@${version}`)
  }
}

const importMap = { ...hostImportMap }

function stampImportMap(file) {
  const html = readFileSync(file, 'utf8')
  if (!html.includes('type="importmap"')) throw new Error(`No importmap to stamp in ${file}`)
  const script = `<script type="importmap">\n            ${JSON.stringify({ imports: importMap })}\n        </script>`
  const next = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, script)
  if (next !== html) writeFileSync(file, next)
}

const vueBindings = new Set(runtimeExports)
function collectVueBindings(code) {
  for (const match of code.matchAll(/import\s*({[^}]*}|\*\s*as\s+\S+)\s*from\s*["']vue["']/g)) {
    if (match[1].startsWith('*')) {
      vueBindings.add('*')
      continue
    }
    for (const part of match[1].slice(1, -1).split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim()
      if (name) vueBindings.add(name)
    }
  }
}

async function buildPass(config) {
  const { output } = await build({ configFile: false, define: defines, logLevel: 'warn', ...config })
  for (const chunk of output) if (chunk.type === 'chunk') collectVueBindings(chunk.code)
}

assertSingleVueCopy()

await buildPass({
  plugins: [
    internalBoundary({ internals, imports, outDir, importMap }),
    unocss(),
    vue(),
  ],
  build: {
    outDir,
    emptyOutDir: true,
    ...readable,
    cssCodeSplit: false,
    rollupOptions: {
      input: { boot: 'src/boot.js' },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
        manualChunks(id) {
          const island = id.match(/src\/islands\/([^/?]+)\.vue/)
          if (island) return kebab(island[1])
          if (id.includes('src/components/')) return 'shared'
        },
      },
    },
  },
})

const names = [...vueBindings].sort()
const runtimeEntry = vueBindings.has('*')
  ? `export * from 'vue'\n`
  : `export { ${names.join(', ')} } from 'vue'\n`

await buildPass({
  plugins: [{
    name: 'runtime-entry',
    resolveId: id => id === 'virtual:vue-runtime' ? '\0virtual:vue-runtime' : null,
    load: id => id === '\0virtual:vue-runtime' ? runtimeEntry : null,
  }],
  build: {
    outDir,
    emptyOutDir: false,
    ...readable,
    rollupOptions: {
      external: ['@vue/reactivity'],
      input: { vue: 'virtual:vue-runtime' },
      output: { format: 'es', entryFileNames: '[name].js' },
      preserveEntrySignatures: 'allow-extension',
    },
  },
})

await buildPass({
  plugins: [{
    name: 'reactivity-entry',
    resolveId: id => id === 'virtual:reactivity-runtime' ? '\0virtual:reactivity-runtime' : null,
    load: id => id === '\0virtual:reactivity-runtime' ? "export * from '@vue/reactivity'" : null,
  }],
  build: {
    outDir,
    emptyOutDir: false,
    ...readable,
    rollupOptions: {
      input: { reactivity: 'virtual:reactivity-runtime' },
      output: { format: 'es', entryFileNames: '[name].js' },
      preserveEntrySignatures: 'strict',
    },
  },
})

stampImportMap('index.html')
console.log(`islands → ${outDir} (${names.length} vue exports)`)
