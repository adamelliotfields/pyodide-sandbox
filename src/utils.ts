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

/** Returns true if the process has filesystem R/W access to the given path. */
export function hasFSAccess(path: string): boolean {
  if (!process.permission) return true
  return process.permission.has('fs.read', path) && process.permission.has('fs.write', path)
}

/** Returns true if the process has network access. */
export function hasNetAccess(): boolean {
  if (!process.permission) return true
  return process.permission.has('net')
}
