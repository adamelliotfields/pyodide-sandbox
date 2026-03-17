import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { describe, it } from 'node:test'

describe('readStdin', () => {
  it('reads piped input', () => {
    const stdout = execFileSync(
      'node',
      ['-e', 'import { readStdin } from "./src/utils.ts"; console.log(await readStdin())'],
      { input: 'hello world', encoding: 'utf8' }
    )
    assert.strictEqual(stdout.trim(), 'hello world')
  })
})
