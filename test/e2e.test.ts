import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

function run(...args: string[]) {
  return execFileSync(bin, args, { encoding: 'utf-8', timeout: 10_000, stdio: 'pipe' }).trim()
}

const bin = join(import.meta.dirname, '..', 'dist', 'pyodide')

if (!existsSync(bin)) {
  console.log("Skipping e2e tests: 'pyodide' not found in 'dist'")
  process.exit(1)
}

describe('e2e', () => {
  it('runs inline python code', () => {
    assert.equal(run('print(1 + 2)'), '3')
  })

  it('lists packages', () => {
    const out = run('--list-packages')
    assert.ok(out.includes('micropip'))
  })

  it('passes env variables', () => {
    const out = run(
      '-e',
      'FOO=hello',
      '-e',
      'BAR=world',
      'import os; print(os.environ["FOO"] + " " + os.environ["BAR"])'
    )
    assert.equal(out, 'hello world')
  })

  it('rejects env variables without equals sign', () => {
    assert.throws(() => run('-e', 'INVALID', 'print(1)'), /Invalid env format/)
  })
})
