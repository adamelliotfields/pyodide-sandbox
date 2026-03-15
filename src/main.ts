#!/usr/bin/env node
import { createRequire } from 'node:module'
import { EOL } from 'node:os'
import { dirname, join } from 'node:path'
import { isSea } from 'node:sea'

import { Command } from 'commander'
import { loadPyodide } from 'pyodide'
import pyodidePkg from 'pyodide/package.json' with { type: 'json' }
import pyodideLockFile from 'pyodide/pyodide-lock.json' with { type: 'json' }

import pkg from '../package.json' with { type: 'json' }

import { micropipInstall, mountDirectory, prepareRuntime } from './pyodide.ts'
import { readStdin, runPython } from './run.ts'

const require = createRequire(import.meta.url)
const app = new Command()
const appName = Object.keys(pkg.bin || {})[0] || pkg.name

// Packages takes a comma-separated list of package names.
const packagesParser = (val: string) => val.split(',').map((s) => s.trim())

// Env takes KEY=VALUE and can be used multiple times.
const envParser = (val: string, acc: Record<string, string>) => {
  const i = val.indexOf('=')
  if (i === -1) throw new Error(`Invalid env format: "${val}" (expected KEY=VALUE)`)
  acc[val.slice(0, i)] = val.slice(i + 1)
  return acc
}
const envDefault = {} as Record<string, string>

app
  .name(appName)
  .description(pkg.description)
  .argument('[code]', 'python code to execute')
  .option('--cdn-url <url>', 'override the default jsDelivr CDN URL')
  .option(
    '-e, --env <KEY=VALUE>',
    'set environment variables in the sandbox',
    envParser,
    envDefault
  )
  .option('--list-packages', 'list installed Pyodide packages')
  .option(
    '-p, --packages <names>',
    'install comma-separated packages before running',
    packagesParser
  )
  .version(pkg.version, '-v, --version')

app.action(
  async (
    code: string | undefined,
    options: {
      env?: Record<string, string>
      packages?: string[]
      cdnUrl?: string
      listPackages?: boolean
    }
  ) => {
    // List packages and exit.
    if (options.listPackages) {
      const packageList = Object.keys(pyodideLockFile.packages).sort().join(EOL)
      return console.log(packageList)
    }

    // Ensure we have code to run.
    const source = code || (await readStdin())
    if (typeof source === 'undefined' || source === null || source.trim().length === 0) {
      console.error(`Usage: ${appName} ${app.usage()}`)
      process.exit(1)
    }

    // Cache runtime assets and downloaded wheels.
    const runtimeDir = join('/tmp', 'pyodide', `v${pyodidePkg.version}`)
    const indexURL = isSea() ? runtimeDir : dirname(require.resolve('pyodide/package.json'))

    // Creates /tmp/pyodide and copies bundled Pyodide assets on first run.
    if (isSea()) {
      prepareRuntime(runtimeDir)
    }

    // The CDN URL version must match our Pyodide version.
    const cdnUrl = options.cdnUrl || `https://cdn.jsdelivr.net/pyodide/v${pyodidePkg.version}/full/`

    // Note that Pyodide will still log "caching the wheel in node_modules" even when using a custom folder.
    const packageCacheDir = join(indexURL, 'full')
    const pyodidePackages = (options.packages || []).filter((p) => p in pyodideLockFile.packages)
    const micropipPackages = (options.packages || []).filter(
      (p) => !(p in pyodideLockFile.packages)
    )

    // Pyodide must be able to mutate `process.exitCode` so we use seal instead of freeze.
    globalThis.process = Object.seal({
      argv: [],
      env: {},
      exitCode: 0,
      browser: false,
      nextTick: process.nextTick,
      platform: process.platform,
      stderr: process.stderr,
      stdin: process.stdin,
      stdout: process.stdout,
      version: process.version,
      versions: process.versions,
      getBuiltinModule: () => null,
      exit: (code: number) => {
        process.exitCode = code
      }
    }) as unknown as NodeJS.Process

    const pyodide = await loadPyodide({
      cdnUrl,
      indexURL,
      packageCacheDir,
      lockFileContents: JSON.stringify(pyodideLockFile),
      // Conditionally add these as Pyodide doesn't handle empty arrays/objects well.
      ...(pyodidePackages.length > 0 && { packages: pyodidePackages }),
      ...(Object.keys(options.env || {}).length > 0 && { env: options.env })
    })

    if (micropipPackages.length > 0) {
      await micropipInstall(pyodide, micropipPackages)
    }

    mountDirectory(pyodide, '/tmp', '/tmp')
    await runPython(pyodide, source)
  }
)

app.parseAsync().catch((err: Error) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
