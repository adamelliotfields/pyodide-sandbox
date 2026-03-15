import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { PyodideInterface } from 'pyodide'

import { readAsset } from './utils.ts'

const PYODIDE_RUNTIME_ASSETS = ['pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip'] as const

/** Prepares and loads Pyodide runtime assets into the provided cache directory. */
export function prepareRuntime(runtimeDir: string): void {
  mkdirSync(runtimeDir, { recursive: true })

  for (const asset of PYODIDE_RUNTIME_ASSETS) {
    const path = join(runtimeDir, asset)
    if (!existsSync(path)) {
      writeFileSync(path, readAsset(`${asset}`))
    }
  }

  if (typeof Reflect.get(globalThis, '_createPyodideModule') !== 'function') {
    const runtimeFilename = join(runtimeDir, 'pyodide.asm.js')
    createRequire(pathToFileURL(runtimeFilename))(runtimeFilename)
  }
}

/** Installs unbundled packages via micropip. */
export async function micropipInstall(pyodide: PyodideInterface, packages: string[]) {
  if (packages.length === 0) return
  await pyodide.loadPackage('micropip')
  const micropip = pyodide.pyimport('micropip')
  await micropip.install(packages)
}

/** Mounts a host directory into the Pyodide filesystem at the requested guest path. */
export function mountDirectory(pyodide: PyodideInterface, hostPath: string, guestPath: string) {
  pyodide.FS.mkdirTree(guestPath)
  pyodide.mountNodeFS(guestPath, hostPath)
}
