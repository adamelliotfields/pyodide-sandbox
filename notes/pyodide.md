# Pyodide

## Running Python code

```ts
import { loadPyodide } from "pyodide"

const pyodide = await loadPyodide()

await pyodide.runPythonAsync(`
    import sys
    sys.version
`)
```

## Loading external packages

```ts
await pyodide.runPythonAsync(`
    from pyodide.http import pyfetch
    response = await pyfetch("https://.../your_package.tar.gz") # .zip, .whl, etc.
    await response.unpack_archive() # unpacks to pwd
`)
pkg = pyodide.pyimport('your_package')
pkg.do_something()
```

## Loading external files

```ts
await pyodide.runPythonAsync(`
    from pyodide.http import pyfetch
    response = await pyfetch("https://.../your_script.py")
    with open("your_script.py", "wb") as f:
        f.write(await response.bytes())
`)
pkg = pyodide.pyimport('your_script')
pkg.do_something()
```

## Reading from the filesystem

```ts
let data = "hello world!"
pyodide.FS.writeFile('/hello.txt', data, { encoding: 'utf8' })
pyodide.runPython(`
    from pathlib import Path

    print(Path("/hello.txt").read_text())
`)
```

## Writing to the filesystem

```ts
pyodide.runPython(`
    from pathlib import Path

    Path("/hello.txt").write_text("hello world!")
`)

let file = pyodide.FS.readFile('/hello.txt', { encoding: 'utf8' })
console.log(file)
```

## Mounting host file system

The default file system is [MEMFS](https://emscripten.org/docs/api_reference/Filesystem-API.html#memfs). You can also use [NODEFS](https://emscripten.org/docs/api_reference/Filesystem-API.html#nodefs):

```ts
pyodide.mountNodeFS('folder', 'path/to/folder')
```

## Bundling Pyodide Files

### Vite

In your `vite.config.mjs` file, exclude Pyodide from Vite's dependency pre-bundling by setting `optimizeDeps.exclude` and ensure that all Pyodide files will be available in `dist/assets` for production builds by using a Vite plugin:

```ts
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const PYODIDE_EXCLUDE = [
  '!**/*.{md,html}',
  '!**/*.d.ts',
  '!**/*.whl',
  '!**/node_modules'
]

export function viteStaticCopyPyodide() {
  const pyodideDir = dirname(fileURLToPath(import.meta.resolve('pyodide')))
  return viteStaticCopy({
    targets: [
      {
        src: [join(pyodideDir, '*').replace(/\\/g, '/')].concat(PYODIDE_EXCLUDE),
        dest: 'assets'
      }
    ]
  })
}

export default defineConfig({
  optimizeDeps: { exclude: ["pyodide"] },
  plugins: [viteStaticCopyPyodide()]
})
```

If you need to specify a specific path for the bundled files, you can set the `indexURL` parameter:

```ts
const pyodide = await loadPyodide({
  indexURL: '/assets' // Path to the directory containing pyodide.js and other files
})
```
