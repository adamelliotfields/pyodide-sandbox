#!/usr/bin/env node
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import pyodidePkg from '../node_modules/pyodide/package.json' with { type: 'json' }
import pyodideLock from '../node_modules/pyodide/pyodide-lock.json' with { type: 'json' }

const PACKAGE_FILES = [...Object.values(pyodideLock.packages).map((pkg) => pkg.file_name)]
const CDN_BASE_URL = `https://cdn.jsdelivr.net/pyodide/v${pyodidePkg.version}/full/`
const CACHE_DIR = resolve('.cache', 'pyodide', `v${pyodidePkg.version}`, 'full')

/** Download a file from the CDN and save it to the cache directory if it doesn't already exist. */
async function downloadPackage(fileName: string) {
  const cachePath = join(CACHE_DIR, fileName)
  if (existsSync(cachePath)) return
  mkdirSync(dirname(cachePath), { recursive: true })
  const response = await fetch(new URL(fileName, CDN_BASE_URL))
  if (!response.ok) {
    throw new Error(`Failed to download ${fileName}: ${response.status} ${response.statusText}`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  await writeFile(cachePath, bytes)
}

/** Download files with a concurrency limit. */
async function concurrentDownloads(fileNames: string[], concurrency = 8) {
  let index = 0
  async function worker() {
    while (index < fileNames.length) {
      const fileName = fileNames[index++]
      await downloadPackage(fileName)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
}

mkdirSync(CACHE_DIR, { recursive: true })
await concurrentDownloads(PACKAGE_FILES)

// Log number of packages and total size in MiB
const packageBytes = PACKAGE_FILES.reduce(
  (sum, fileName) => sum + statSync(join(CACHE_DIR, fileName)).size,
  0
)
console.log(
  `Downloaded ${PACKAGE_FILES.length} Pyodide wheels to local cache (${Math.round(packageBytes / 1024 / 1024)} MiB)`
)
