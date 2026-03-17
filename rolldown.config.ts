import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { basename, join, resolve } from 'node:path'

import { defineConfig, type Plugin } from 'rolldown'

import pyodidePkg from './node_modules/pyodide/package.json' with { type: 'json' }

type CopyTarget = {
  src: string | string[]
  dest: string
}

const ALLOW_NET = process.env.ALLOW_NET === '1' || process.env.ALLOW_NET?.toLowerCase() === 'true'
const ALLOW_FS = process.env.ALLOW_FS || ''

const SEA_EXECARGV = ['--no-warnings', '--no-deprecation', '--permission']
if (ALLOW_NET) {
  SEA_EXECARGV.push('--allow-net')
}
if (ALLOW_FS) {
  SEA_EXECARGV.push(`--allow-fs-read=${ALLOW_FS}`, `--allow-fs-write=${ALLOW_FS}`)
}

const SEA_CONFIG = {
  main: 'dist/pyodide.cjs',
  output: 'dist/pyodide',
  execArgvExtension: 'none',
  execArgv: SEA_EXECARGV,
  disableExperimentalSEAWarning: true,
  useCodeCache: false,
  useSnapshot: false
}

const RUNTIME_ASSETS = ['pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip']
const DIST_DIR = resolve('dist')
const CACHE_DIR = resolve('.cache', 'pyodide', `v${pyodidePkg.version}`, 'full')

// Replace the process.binding('constants').fs flags with their numeric values
const PYODIDE_FLAGS_SEARCH =
  'var flags=process.binding("constants")["fs"];NODEFS.flagsForNodeMap={1024:flags["O_APPEND"],64:flags["O_CREAT"],128:flags["O_EXCL"],256:flags["O_NOCTTY"],0:flags["O_RDONLY"],2:flags["O_RDWR"],4096:flags["O_SYNC"],512:flags["O_TRUNC"],1:flags["O_WRONLY"],131072:flags["O_NOFOLLOW"]}'
const PYODIDE_FLAGS_REPLACE =
  'NODEFS.flagsForNodeMap={1024:1024,64:64,128:128,256:256,0:0,2:2,4096:1052672,512:512,1:1,131072:131072}'

// Patch Pyodide's minified getBinaryResponse function "ce" with our SEA-aware getAsset function
const PYODIDE_BINARY_SEARCH =
  'function ce(e,t){return e.startsWith("file://")&&(e=e.slice(7)),e.includes("://")?{response:fetch(e)}:{binary:L.readFile(e).then(n=>new Uint8Array(n.buffer,n.byteOffset,n.byteLength))}}'
const PYODIDE_BINARY_REPLACE =
  'function ce(e,t){var a=globalThis.__getAsset;if(a){var b=a(e);if(b)return{binary:Promise.resolve(b)}}e.startsWith("file://")&&(e=e.slice(7));return e.includes("://")?{response:fetch(e)}:{binary:L.readFile(e).then(n=>new Uint8Array(n.buffer,n.byteOffset,n.byteLength))}}'

/** Copy static assets to the output directory. */
function copy({ targets }: { targets: CopyTarget[] }): Plugin {
  return {
    name: 'copy',
    writeBundle() {
      for (const target of targets) {
        mkdirSync(resolve(target.dest), { recursive: true })
        for (const src of [target.src].flat()) {
          const from = resolve(src)
          const to = resolve(target.dest, basename(src))
          cpSync(from, to)
        }
      }
    }
  }
}

/** Patch Pyodide files for Node SEA compatibility. */
function patchPyodide(): Plugin {
  function patch(code: string, search: string, replace: string, label: string): string {
    if (!code.includes(search)) {
      throw new Error(`Unable to patch ${label}: expected block not found`)
    }
    return code.replace(search, replace)
  }
  return {
    name: 'patch-pyodide',
    // Patch pyodide.mjs before it gets bundled
    transform(code, id) {
      if (!id.includes('pyodide.mjs')) return
      return patch(code, PYODIDE_BINARY_SEARCH, PYODIDE_BINARY_REPLACE, 'pyodide.mjs')
    },
    // Patch pyodide.asm.js here since it is copied to dist
    writeBundle() {
      const file = resolve('dist', 'pyodide.asm.js')
      const source = readFileSync(file, 'utf-8')
      const patched = patch(source, PYODIDE_FLAGS_SEARCH, PYODIDE_FLAGS_REPLACE, file)
      writeFileSync(file, patched)
    }
  }
}

/** Generate sea-config.json with asset paths pointing to dist and .cache. */
function seaConfig(): Plugin {
  return {
    name: 'sea-config',
    writeBundle() {
      const assets: Record<string, string> = {}
      // Runtime assets from dist
      for (const asset of RUNTIME_ASSETS) {
        assets[asset] = join(DIST_DIR, asset)
      }
      // Package wheels from .cache if downloaded
      if (existsSync(CACHE_DIR)) {
        for (const fileName of readdirSync(CACHE_DIR)) {
          assets[fileName] = join(CACHE_DIR, fileName)
        }
      }
      writeFileSync(
        join(DIST_DIR, 'sea-config.json'),
        JSON.stringify({ ...SEA_CONFIG, assets }, null, 2)
      )
    }
  }
}

export default defineConfig({
  input: 'src/main.ts',
  platform: 'node',
  output: {
    file: 'dist/pyodide.cjs',
    format: 'cjs',
    codeSplitting: false
  },
  external: [
    // exclude node built-ins
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`)
  ],
  plugins: [
    copy({
      targets: [
        {
          src: [
            'node_modules/pyodide/pyodide.asm.js',
            'node_modules/pyodide/pyodide.asm.wasm',
            'node_modules/pyodide/python_stdlib.zip'
          ],
          dest: 'dist'
        }
      ]
    }),
    patchPyodide(),
    seaConfig()
  ],
  resolve: {
    extensions: ['.ts', '.js', '.json']
  }
})
