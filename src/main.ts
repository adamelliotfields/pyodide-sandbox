#!/usr/bin/env node
import { createRequire } from 'node:module'
import { EOL, homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { isSea } from 'node:sea'

import { Command } from 'commander'
import { loadPyodide } from 'pyodide'
import pyodidePkg from 'pyodide/package.json' with { type: 'json' }
import pyodideLockFile from 'pyodide/pyodide-lock.json' with { type: 'json' }

import pkg from '../package.json' with { type: 'json' }

import { micropipInstall, mountDirectory, prepareRuntime } from './pyodide.ts'
import { readSource, runPython } from './run.ts'
import { serve } from './serve.ts'

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

// Mount can be used multiple times.
const mountParser = (val: string, acc: string[]) => [...acc, val]
const mountDefault = [] as string[]

app
  .name(appName)
  .description(pkg.description)
  .option('-c, --code <code>', 'Python code to execute')
  .option(
    '-e, --env <KEY=VALUE>',
    'set environment variables in the sandbox',
    envParser,
    envDefault
  )
  .option('-f, --file <path>', 'run a Python file')
  .option(
    '-m, --mount <host:guest>',
    'mount host directories to the sandbox',
    mountParser,
    mountDefault
  )
  .option(
    '-p, --packages <names>',
    'install comma-separated packages before running',
    packagesParser
  )
  .option('--cache-dir <path>', 'override the package cache directory')
  .option('--cdn-url <url>', 'override the default jsDelivr CDN URL')
  .option('--list-packages', 'list installed Pyodide packages')
  .version(pkg.version, '-v, --version')

app
  .command('serve')
  .description('start a web server for the Pyodide xterm.js REPL')
  .option('--port <number>', 'port to listen on', '8000')
  .action((options: { port: string }) => {
    console.log(options)
    serve(Number(options.port))
  })

app.action(
  async (options: {
    code?: string
    env?: Record<string, string>
    file?: string
    packages?: string[]
    mount?: string[]
    cacheDir?: string
    cdnUrl?: string
    listPackages?: boolean
  }) => {
    // List packages and exit.
    if (options.listPackages) {
      const packageList = Object.keys(pyodideLockFile.packages).sort().join(EOL)
      return console.log(packageList)
    }

    // Source code could be a file or inline string.
    const source = readSource(options.file, options.code)
    if (source === null || source.trim().length === 0) {
      console.error(`Usage: ${appName} ${app.usage()}`)
      process.exit(1)
    }

    // Cache runtime assets and downloaded wheels.
    const cacheRoot = process.env.XDG_CACHE_HOME || join(homedir(), '.cache')
    const runtimeDir = join(cacheRoot, 'pyodide', `v${pyodidePkg.version}`)
    const indexURL = isSea() ? runtimeDir : dirname(require.resolve('pyodide/package.json'))

    // Creates XDG_CACHE_HOME/pyodide and copies bundled Pyodide assets on first run.
    if (isSea()) {
      prepareRuntime(runtimeDir)
    }

    // The CDN URL version must match our Pyodide version.
    const cdnUrl = options.cdnUrl || `https://cdn.jsdelivr.net/pyodide/v${pyodidePkg.version}/full/`

    // Note that Pyodide will still log "caching the wheel in node_modules" even when using a custom folder.
    const packageCacheDir = options.cacheDir || join(indexURL, 'full')
    const pyodidePackages = (options.packages || []).filter((p) => p in pyodideLockFile.packages)
    const micropipPackages = (options.packages || []).filter(
      (p) => !(p in pyodideLockFile.packages)
    )

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

    for (const mount of options.mount || []) {
      mountDirectory(pyodide, mount)
    }

    await runPython(pyodide, source)
  }
)

app.parseAsync().catch((err: Error) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
