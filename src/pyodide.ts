import { createRequire } from 'node:module'
import { getAsset } from 'node:sea'
import vm from 'node:vm'

import type { PyodideInterface } from 'pyodide'
import pyodideLockfile from 'pyodide/pyodide-lock.json' with { type: 'json' }

interface LockfileFile {
  file_name: string
}

interface Package {
  name: string
  channel: string
  normalizedName: string
}

interface PackageManager {
  cdnURL: string
  defaultChannel: string
  downloadPackage: (pkg: Package) => Promise<Uint8Array>
}

interface PyodideApi {
  lockfile_packages: Record<string, LockfileFile>
  packageManager: PackageManager
}

const PYODIDE_ASSETS = [
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  ...Object.values(pyodideLockfile.packages).map((pkg) => pkg.file_name)
]

/** Returns the SEA asset path if the requested path corresponds to a bundled runtime or package asset. */
export function getSeaAssetPath(path: string): string | undefined {
  const fileName = path.split('?')[0].split('/').pop()
  if (fileName && PYODIDE_ASSETS.includes(fileName)) return fileName
  return undefined
}

/** Prepares Pyodide runtime from SEA assets without filesystem access. */
export function prepareRuntime(): void {
  // Hook into Pyodide's patched node_getBinaryResponse to serve assets from the SEA blob
  Reflect.set(globalThis, '__getAsset', (path: string) => {
    const assetPath = getSeaAssetPath(path)
    if (assetPath) return new Uint8Array(getAsset(assetPath))
    return undefined
  })

  if (typeof Reflect.get(globalThis, '_createPyodideModule') !== 'function') {
    // Pyodide expects CJS globals
    Reflect.set(globalThis, 'require', createRequire(import.meta.url))
    Reflect.set(globalThis, '__dirname', '.')
    // https://nodejs.org/api/vm.html#support-of-dynamic-import-in-compilation-apis
    const script = new vm.Script(getAsset('pyodide.asm.js', 'utf8'), {
      importModuleDynamically: vm.constants?.USE_MAIN_CONTEXT_DEFAULT_LOADER
    })
    script.runInThisContext()
  }
}

/** Override built-in Pyodide package downloads to read wheel assets from SEA. */
export function preparePackageManager(pyodide: PyodideInterface): void {
  const api = Reflect.get(pyodide as object, '_api') as PyodideApi | undefined
  const packageManager = api?.packageManager
  if (!api || !packageManager) return

  packageManager.downloadPackage = async function (pkg) {
    const lockfilePackage = api.lockfile_packages[pkg.normalizedName]
    if (!lockfilePackage) throw new Error(`No entry for package ${pkg.name}`)

    const fileName = lockfilePackage.file_name
    try {
      return new Uint8Array(getAsset(fileName))
    } catch {
      // Fall back to CDN if the asset isn't embedded in the SEA blob
      const response = await fetch(`${this.cdnURL}${fileName}`)
      if (!response.ok) throw new Error(`Failed to load '${fileName}'`)
      return new Uint8Array(await response.arrayBuffer())
    }
  }
}
