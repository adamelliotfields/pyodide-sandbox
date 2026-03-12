import { getAsset, isSea } from 'node:sea'

/** Read an asset from the SEA binary and return it as text or bytes. */
export function readAsset(name: string): Uint8Array
export function readAsset(name: string, encoding: 'utf8'): string
export function readAsset(name: string, encoding?: 'utf8'): Uint8Array | string {
  if (!isSea()) throw new Error(`Asset "${name}" is unavailable outside SEA`)
  return encoding ? getAsset(name, encoding) : new Uint8Array(getAsset(name))
}
