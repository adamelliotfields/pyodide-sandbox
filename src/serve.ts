import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { isSea } from 'node:sea'

import { readAsset } from './utils.ts'

const require = createRequire(import.meta.url)
const pyodideDir = isSea() ? '' : dirname(require.resolve('pyodide/package.json'))

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.zip': 'application/zip',
  '.map': 'application/json; charset=utf-8'
}

const PYODIDE_ASSETS = [
  'index.html',
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'pyodide.mjs',
  'pyodide.mjs.map',
  'pyodide-lock.json',
  'python_stdlib.zip'
] as const

function contentType(filename: string): string {
  for (const [ext, type] of Object.entries(CONTENT_TYPES)) {
    if (filename.endsWith(ext)) return type
  }
  return 'application/octet-stream'
}

function loadFile(filename: string): Buffer | Uint8Array {
  // The v2 console uses xterm.js instead of jQuery.
  const assetName = filename === 'index.html' ? 'console-v2.html' : filename
  if (isSea()) return readAsset(assetName)
  return readFileSync(join(pyodideDir, assetName))
}

/** Starts a file server for the Pyodide xterm.js REPL. */
export function serve(port: number): void {
  const files = new Map<string, Buffer | Uint8Array>()

  // Preload all files into memory.
  for (const asset of PYODIDE_ASSETS) {
    files.set(asset, loadFile(asset))
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`)
    const pathname = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    const body = files.get(pathname)

    if (!body) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('Not Found')
      return
    }

    res.writeHead(200, {
      'content-type': contentType(pathname),
      'content-length': body.length,
      'cache-control': 'no-cache'
    })
    res.end(body)
  })

  server.listen(port, () => {
    console.log(`Pyodide REPL: http://localhost:${port}`)
  })
}
