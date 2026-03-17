#!/usr/bin/env node
import { createRequire } from 'node:module'
import { EOL } from 'node:os'
import { dirname, join } from 'node:path'
import { isSea } from 'node:sea'

import { Command } from 'commander'
import { loadPyodide } from 'pyodide'
import pyodideLockFile from 'pyodide/pyodide-lock.json' with { type: 'json' }

import pkg from '../package.json' with { type: 'json' }

import { preparePackageManager, prepareRuntime } from './pyodide.ts'
import { hasFSAccess, hasNetAccess, readStdin } from './utils.ts'

const IS_SEA = isSea()

const require = createRequire(import.meta.url)
const app = new Command()
const appName = Object.keys(pkg.bin || {})[0] || pkg.name

// Packages takes a comma-separated list of package names.
const packagesParser = (val: string) => val.split(',').map((s) => s.trim())

// Env takes KEY=VALUE and can be used multiple times.
const envParser = (val: string, acc: Record<string, string>) => {
  const i = val.indexOf('=')
  if (i === -1) throw new Error(`Invalid env format: '${val}' (expected KEY=VALUE)`)
  acc[val.slice(0, i)] = val.slice(i + 1)
  return acc
}
const envDefault = {} as Record<string, string>

// Hide host environment variables
globalThis.process.env = {}

app
  .name(appName)
  .description(pkg.description)
  .argument('[code]', 'python code to execute')
  .option(
    '-e, --env <key=value>',
    'set environment variables in the sandbox',
    envParser,
    envDefault
  )
  .option('--list-packages', 'list installed Pyodide packages')
  .option('-m, --mount <host:guest>', 'mount a host directory into the sandbox')
  .option('-p, --packages <names>', 'load comma-separated packages before running', packagesParser)
  .version(pkg.version, '-v, --version')

app.action(
  async (
    code: string | undefined,
    options: {
      env?: Record<string, string>
      mount?: string
      packages?: string[]
      listPackages?: boolean
    }
  ) => {
    // List packages and exit
    if (options.listPackages) {
      const packageList = Object.keys(pyodideLockFile.packages).sort().join(EOL)
      return console.log(packageList)
    }

    // Ensure we have code to run
    const source = code || (await readStdin())
    if (typeof source === 'undefined' || source === null || source.trim().length === 0) {
      console.error(`Usage: ${appName} ${app.usage()}`)
      process.exit(1)
    }

    let indexURL = ''
    if (!IS_SEA) {
      indexURL = dirname(require.resolve('pyodide/package.json'))
    } else {
      prepareRuntime()
    }

    const pyodide = await loadPyodide({
      indexURL,
      packageCacheDir: IS_SEA ? undefined : join(indexURL, 'full'),
      lockFileContents: JSON.stringify(pyodideLockFile),
      ...(Object.keys(options.env || {}).length > 0 && { env: options.env })
    })

    if (IS_SEA) {
      preparePackageManager(pyodide)
    }

    // Load requested packages before running code
    const pyodidePackages = (options.packages || []).filter((p) => p in pyodideLockFile.packages)
    if (pyodidePackages.length > 0) {
      await pyodide.loadPackage(pyodidePackages)
    }

    // Install micropip and unbundled packages
    const micropipPackages = (options.packages || []).filter(
      (p) => !(p in pyodideLockFile.packages)
    )
    if (micropipPackages.length > 0) {
      if (!hasNetAccess()) {
        throw new Error('No network permission to install packages')
      }
      await pyodide.loadPackage('micropip')
      const micropip = pyodide.pyimport('micropip')
      await micropip.install(micropipPackages)
    }

    // Mount host directory if requested (host:guest or just host)
    if (options.mount) {
      const parts = options.mount.split(':')
      const hostPath = parts[0]
      const guestPath = parts[1] || hostPath
      if (!hasFSAccess(hostPath)) {
        throw new Error(`No filesystem permission for "${hostPath}"`)
      }
      pyodide.FS.mkdirTree(guestPath)
      pyodide.mountNodeFS(hostPath, guestPath)
    }

    await pyodide.runPythonAsync(source)
  }
)

app.parseAsync().catch((err: Error) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
