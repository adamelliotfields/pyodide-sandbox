# Single executable applications

## Execution arguments

The `execArgv` field can be used to specify Node.js-specific arguments that will be automatically applied when the single executable application starts. This allows application developers to configure Node.js runtime options without requiring end users to be aware of these flags.

For example, the following configuration:

```json
{
  "main": "/path/to/bundled/script.js",
  "output": "/path/to/write/the/generated/executable",
  "execArgv": ["--no-warnings", "--max-old-space-size=2048"]
}
```

will instruct the SEA to be launched with the `--no-warnings` and `--max-old-space-size=2048` flags. In the scripts embedded in the executable, these flags can be accessed using the `process.execArgv` property:

```ts
// If the executable is launched with `sea user-arg1 user-arg2`
console.log(process.execArgv);
// Prints: ['--no-warnings', '--max-old-space-size=2048']
console.log(process.argv);
// Prints ['/path/to/sea', 'path/to/sea', 'user-arg1', 'user-arg2']
```

The user-provided arguments are in the `process.argv` array starting from index 2, similar to what would happen if the application is started with:

```sh
node --no-warnings --max-old-space-size=2048 /path/to/bundled/script.js user-arg1 user-arg2
```

## Execution argument extension

The `execArgvExtension` field controls how additional execution arguments can be provided beyond those specified in the `execArgv` field. It accepts one of three string values:

- `"env"`: _(Default)_ The `NODE_OPTIONS` environment variable can extend the execution arguments. This is the default behavior to maintain backward compatibility.
- `"cli"`: The executable can be launched with `--node-options="--flag1 --flag2"`, and those flags will be parsed as execution arguments for Node.js instead of being passed to the user script. This allows using arguments that are not supported by the `NODE_OPTIONS` environment variable.
- `"none"`: No extension is allowed. Only the arguments specified in `execArgv` will be used, and the `NODE_OPTIONS` environment variable will be ignored.

For example, with `"execArgvExtension": "cli"`:

```json
{
  "main": "/path/to/bundled/script.js",
  "output": "/path/to/write/the/generated/executable",
  "execArgv": ["--no-warnings"],
  "execArgvExtension": "cli"
}
```

The executable can be launched as:

```sh
./my-sea --node-options="--trace-exit" user-arg1 user-arg2
```

This would be equivalent to running:

```sh
node --no-warnings --trace-exit /path/to/bundled/script.js user-arg1 user-arg2
```

## Single-executable application API

The `node:sea` builtin allows interaction with the single-executable application from the JavaScript main script embedded into the executable.

### `sea.isSea()`

- Returns `boolean`: Whether this script is running inside a single-executable application.

### `sea.getAsset(key[, encoding])`

This method can be used to retrieve the assets configured to be bundled into the single-executable application at build time. An error is thrown when no matching asset can be found.

- `key` (`string`): The key for the asset in the dictionary specified by the `assets` field in the single-executable application configuration.
- `encoding` (`string`): If specified, the asset will be decoded as a string. Any encoding supported by the `TextDecoder` is accepted. If unspecified, an `ArrayBuffer` containing a copy of the asset would be returned instead.
- Returns: `string|ArrayBuffer`

### `sea.getAssetAsBlob(key[, options])`

Similar to `sea.getAsset()`, but returns the result in a `Blob`. An error is thrown when no matching asset can be found.

- `key` (`string`): The key for the asset in the dictionary specified by the `assets` field in the single-executable application configuration.
- `options` (`Object`)
  * `type` (`string`): An optional mime type for the blob.
- Returns: `Blob`

### `sea.getRawAsset(key)`

This method can be used to retrieve the assets configured to be bundled into the single-executable application at build time. An error is thrown when no matching asset can be found.

Unlike `sea.getAsset()` or `sea.getAssetAsBlob()`, this method does not return a copy. Instead, it returns the raw asset bundled inside the executable.

For now, users should avoid writing to the returned array buffer. If the injected section is not marked as writable or not aligned properly, writes to the returned array buffer is likely to result in a crash.

- `key` (`string`): The key for the asset in the dictionary specified by the `assets` field in the single-executable application configuration.
- Returns: `ArrayBuffer`

### `sea.getAssetKeys()`

- Returns `string[]`: An array containing all the keys of the assets embedded in the executable. If no assets are embedded, returns an empty array.

This method can be used to retrieve an array of all the keys of assets embedded into the single-executable application. An error is thrown when not running inside a single-executable application.

## Module loading in the injected main script

In the injected main script, module loading does not read from the file system. By default, both `require()` and `import` statements would only be able to load the built-in modules. Attempting to load a module that can only be found in the file system will throw an error.

Users can bundle their application into a standalone JavaScript file to inject into the executable. This also ensures a more deterministic dependency graph.

To load modules from the file system in the injected main script, users can create a `require` function that can load from the file system using `module.createRequire()`. For example, in a CommonJS entry point:

```ts
const { createRequire } = require('node:module');
require = createRequire(__filename);
```

### `require()` in the injected main script

`require()` in the injected main script is not the same as the `require()` available to modules that are not injected. Currently, it does not have any of the properties that non-injected `require()` has except `require.main`.

### `__filename` and `module.filename` in the injected main script

The values of `__filename` and `module.filename` in the injected main script are equal to `process.execPath`.

### `__dirname` in the injected main script

The value of `__dirname` in the injected main script is equal to the directory name of `process.execPath`.

### `import.meta` in the injected main script

When using `"mainFormat": "module"`, `import.meta` is available in the injected main script with the following properties:

* `import.meta.url`: A `file:` URL corresponding to `process.execPath`.
* `import.meta.filename`: Equal to `process.execPath`.
* `import.meta.dirname`: The directory name of `process.execPath`.
* `import.meta.main`: `true`.

`import.meta.resolve` is currently not supported.

### `import()` in the injected main script

When using `"mainFormat": "module"`, `import()` can be used to dynamically load built-in modules. Attempting to use `import()` to load modules from the file system will throw an error.
