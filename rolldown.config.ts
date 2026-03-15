import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { basename, resolve } from 'node:path'

import { defineConfig, type Plugin } from 'rolldown'

type CopyTarget = {
  src: string | string[]
  dest: string
}

const PYODIDE_FLAGS_SEARCH =
  'var flags=process.binding("constants")["fs"];NODEFS.flagsForNodeMap={1024:flags["O_APPEND"],64:flags["O_CREAT"],128:flags["O_EXCL"],256:flags["O_NOCTTY"],0:flags["O_RDONLY"],2:flags["O_RDWR"],4096:flags["O_SYNC"],512:flags["O_TRUNC"],1:flags["O_WRONLY"],131072:flags["O_NOFOLLOW"]}'
const PYODIDE_FLAGS_REPLACE =
  'NODEFS.flagsForNodeMap={1024:1024,64:64,128:128,256:256,0:0,2:2,4096:1052672,512:512,1:1,131072:131072}'

/** Replace the NODEFS flags block with a static mapping. */
function patchPyodideAsset(file: string) {
  const source = readFileSync(file, 'utf-8')
  if (!source.includes('process.binding("constants")')) return

  const patched = source.replace(PYODIDE_FLAGS_SEARCH, PYODIDE_FLAGS_REPLACE)
  if (patched === source) {
    throw new Error(`Unable to patch ${file}: expected Pyodide NODEFS constants block not found`)
  }

  writeFileSync(file, patched)
}

/** A plugin to copy static assets to the output directory. */
function copy({ targets }: { targets: CopyTarget[] }): Plugin {
  return {
    name: 'copy',
    buildStart() {
      for (const target of targets) {
        // Flatten to support both string and string[]
        for (const src of [target.src].flat()) {
          this.addWatchFile(resolve(src))
        }
      }
    },
    writeBundle() {
      for (const target of targets) {
        mkdirSync(resolve(target.dest), { recursive: true })
        for (const src of [target.src].flat()) {
          const from = resolve(src)
          const to = resolve(target.dest, basename(src))
          cpSync(from, to)
          if (basename(src) === 'pyodide.asm.js') {
            patchPyodideAsset(to)
          }
        }
      }
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
    })
  ],
  resolve: {
    extensions: ['.ts', '.js', '.json']
  }
})
