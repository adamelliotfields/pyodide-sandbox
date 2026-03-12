import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

function run(...args: string[]) {
  return execFileSync(bin, args, { encoding: 'utf-8', timeout: 10_000 }).trim()
}

function rmDir(dir: string) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true })
  }
}

const bin = join(
  import.meta.dirname,
  '..',
  'dist',
  process.platform === 'win32' ? 'pyodide.exe' : 'pyodide'
)

if (!existsSync(bin)) {
  console.log(`Skipping e2e tests: ${bin} not found`)
  process.exit(0)
}

describe('e2e', () => {
  it('runs inline python code', () => {
    assert.equal(run('-c', 'print(1 + 2)'), '3')
  })

  it('runs a python file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pyodide-e2e-'))
    try {
      const file = join(dir, 'hello.py')
      writeFileSync(file, 'print("hello from file")')
      assert.equal(run('-f', file), 'hello from file')
    } finally {
      rmDir(dir)
    }
  })

  it('mounts a host directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pyodide-e2e-'))
    try {
      writeFileSync(join(dir, 'data.txt'), 'mount works')
      const out = run('-m', `${dir}:/mnt`, '-c', "with open('/mnt/data.txt') as f: print(f.read())")
      assert.equal(out, 'mount works')
    } finally {
      rmDir(dir)
    }
  })

  it('mounts multiple host directories', () => {
    const dir1 = mkdtempSync(join(tmpdir(), 'pyodide-e2e-'))
    const dir2 = mkdtempSync(join(tmpdir(), 'pyodide-e2e-'))
    try {
      writeFileSync(join(dir1, 'a.txt'), 'hello')
      writeFileSync(join(dir2, 'b.txt'), ' world')
      const out = run(
        '-m',
        `${dir1}:/mnt1`,
        '-m',
        `${dir2}:/mnt2`,
        '-c',
        `import pathlib
a = pathlib.Path('/mnt1/a.txt').read_text()
b = pathlib.Path('/mnt2/b.txt').read_text()
print(a + b)
`.trim()
      )
      assert.equal(out, 'hello world')
    } finally {
      rmDir(dir1)
      rmDir(dir2)
    }
  })

  it('isolates the filesystem without mounts', () => {
    const out = run(
      '-c',
      `import os
try:
    os.listdir('/mnt')
    print('not isolated')
except OSError:
    print('isolated')
`.trim()
    )
    assert.equal(out, 'isolated')
  })

  it('installs packages with --packages', () => {
    const out = run('-p', 'regex', '-c', 'import regex; print(regex.__name__)')
    assert.ok(out.endsWith('regex'))
  })

  it('lists packages', () => {
    const out = run('--list-packages')
    assert.ok(out.includes('micropip'))
  })

  it('passes a single env variable', () => {
    const out = run('-e', 'FOO=bar', '-c', 'import os; print(os.environ["FOO"])')
    assert.equal(out, 'bar')
  })

  it('passes multiple env variables', () => {
    const out = run(
      '-e',
      'FOO=hello',
      '-e',
      'BAR=world',
      '-c',
      'import os; print(os.environ["FOO"] + " " + os.environ["BAR"])'
    )
    assert.equal(out, 'hello world')
  })

  it('handles env values with equals signs', () => {
    const out = run(
      '-e',
      'CONN=host=localhost;port=5432',
      '-c',
      'import os; print(os.environ["CONN"])'
    )
    assert.equal(out, 'host=localhost;port=5432')
  })

  it('handles env values with empty string', () => {
    const out = run('-e', 'EMPTY=', '-c', 'import os; print(repr(os.environ["EMPTY"]))')
    assert.equal(out, "''")
  })

  it('rejects env without equals sign', () => {
    assert.throws(() => run('-e', 'INVALID', '-c', 'print(1)'), /Invalid env format/)
  })
})
