import { cpSync, mkdirSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { basename, resolve } from 'node:path'

import { defineConfig, type Plugin } from 'rolldown'

type CopyTarget = {
  src: string | string[]
  dest: string
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
            'node_modules/pyodide/console-v2.html',
            'node_modules/pyodide/pyodide.asm.js',
            'node_modules/pyodide/pyodide.asm.wasm',
            'node_modules/pyodide/pyodide.mjs',
            'node_modules/pyodide/pyodide.mjs.map',
            'node_modules/pyodide/pyodide-lock.json',
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
