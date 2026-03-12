import { readFileSync } from 'node:fs'

import type { PyodideInterface } from 'pyodide'

/** Returns source code from a file path or inline code value when provided. */
export function readSource(file: string | undefined, code: string | undefined): string | null {
  if (file) return readFileSync(file, 'utf-8')
  if (code) return code
  return null
}

/** Reads all UTF-8 text from standard input. */
export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

/** Executes Python source code asynchronously in the provided Pyodide instance. */
export async function runPython(pyodide: PyodideInterface, source: string): Promise<void> {
  await pyodide.runPythonAsync(source)
}
