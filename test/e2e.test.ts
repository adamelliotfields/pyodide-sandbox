import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

function run(...args: string[]) {
  return execFileSync(bin, args, { encoding: 'utf-8', timeout: 10_000, stdio: 'pipe' }).trim()
}

const bin = join(import.meta.dirname, '..', 'dist', 'pyodide')

if (process.platform === 'win32') {
  console.log('Skipping e2e tests: Windows is not supported')
  process.exit(1)
}

if (!existsSync(bin)) {
  console.log(`Skipping e2e tests: ${bin} not found`)
  process.exit(1)
}

describe('e2e', () => {
  it('runs inline python code', () => {
    assert.equal(run('print(1 + 2)'), '3')
  })

  it('installs built-in Pyodide packages with --packages', () => {
    const out = run('-p', 'regex', 'import regex; print(regex.__name__)')
    assert.ok(out.endsWith('regex'))
  })

  it('installs micropip packages with --packages', () => {
    const out = run('-p', 'pyfiglet', 'import pyfiglet; print(pyfiglet.__name__)')
    assert.equal(out.split('\n').at(-1), 'pyfiglet')
  })

  it('lists packages', () => {
    const out = run('--list-packages')
    assert.ok(out.includes('micropip'))
  })

  it('passes a single env variable', () => {
    const out = run('-e', 'FOO=bar', 'import os; print(os.environ["FOO"])')
    assert.equal(out, 'bar')
  })

  it('passes multiple env variables', () => {
    const out = run(
      '-e',
      'FOO=hello',
      '-e',
      'BAR=world',
      'import os; print(os.environ["FOO"] + " " + os.environ["BAR"])'
    )
    assert.equal(out, 'hello world')
  })

  it('handles env values with equals signs', () => {
    const out = run('-e', 'CONN=host=localhost;port=5432', 'import os; print(os.environ["CONN"])')
    assert.equal(out, 'host=localhost;port=5432')
  })

  it('handles env values with empty string', () => {
    const out = run('-e', 'EMPTY=', 'import os; print(repr(os.environ["EMPTY"]))')
    assert.equal(out, "''")
  })

  it('rejects env without equals sign', () => {
    assert.throws(() => run('-e', 'INVALID', 'print(1)'), /Invalid env format/)
  })
})
