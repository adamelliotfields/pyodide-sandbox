import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getSeaAssetPath, preparePackageManager } from '../src/pyodide.ts'

describe('getSeaAssetPath', () => {
  it('returns filename for runtime asset', () => {
    assert.strictEqual(getSeaAssetPath('pyodide.asm.js'), 'pyodide.asm.js')
    assert.strictEqual(getSeaAssetPath('pyodide.asm.wasm'), 'pyodide.asm.wasm')
    assert.strictEqual(getSeaAssetPath('python_stdlib.zip'), 'python_stdlib.zip')
  })

  it('strips file:// prefix', () => {
    assert.strictEqual(getSeaAssetPath('file:///tmp/pyodide/pyodide.asm.js'), 'pyodide.asm.js')
  })

  it('strips query string', () => {
    assert.strictEqual(getSeaAssetPath('pyodide.asm.wasm?v=123'), 'pyodide.asm.wasm')
  })

  it('extracts filename from full path', () => {
    assert.strictEqual(getSeaAssetPath('/tmp/pyodide/pyodide.asm.js'), 'pyodide.asm.js')
  })

  it('returns undefined for unknown asset', () => {
    assert.strictEqual(getSeaAssetPath('unknown.js'), undefined)
  })

  it('returns undefined for empty string', () => {
    assert.strictEqual(getSeaAssetPath(''), undefined)
  })
})

describe('preparePackageManager', () => {
  it('replaces downloadPackage', () => {
    const original = async () => new Uint8Array()
    const mock = {
      _api: {
        lockfile_packages: { numpy: { file_name: 'numpy-2.2.5.whl' } },
        packageManager: { cdnURL: 'https://cdn.example.com/', downloadPackage: original }
      }
    }
    // biome-ignore lint/suspicious/noExplicitAny: mock
    preparePackageManager(mock as any)
    assert.notStrictEqual(mock._api.packageManager.downloadPackage, original)
  })

  it('is a no-op without _api', () => {
    const mock = {}
    // biome-ignore lint/suspicious/noExplicitAny: mock
    preparePackageManager(mock as any)
    assert.strictEqual(Reflect.get(mock, 'downloadPackage'), undefined)
  })

  it('is a no-op without packageManager', () => {
    const mock = { _api: { lockfile_packages: {} } }
    // biome-ignore lint/suspicious/noExplicitAny: mock
    preparePackageManager(mock as any)
    assert.strictEqual(Reflect.get(mock._api, 'downloadPackage'), undefined)
  })
})
