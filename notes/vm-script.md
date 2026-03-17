# Class: `vm.Script`

Instances of the `vm.Script` class contain precompiled scripts that can be executed in specific contexts.

## `new vm.Script(code[, options])`

- `code` {`string`} The JavaScript code to compile.
- `options` {`Object`|`string`}
  * `filename` {`string`} Specifies the filename used in stack traces produced by this script. **Default:** `'evalmachine.<anonymous>'`.
  * `lineOffset` {`number`} Specifies the line number offset that is displayed in stack traces produced by this script. **Default:** `0`.
  * `columnOffset` {`number`} Specifies the first-line column number offset that is displayed in stack traces produced by this script. **Default:** `0`.
  * `cachedData` {`Buffer`|`TypedArray`|`DataView`} Provides an optional `Buffer` or `TypedArray`, or `DataView` with V8's code cache data for the supplied source. When supplied, the `cachedDataRejected` value will be set to either `true` or `false` depending on acceptance of the data by V8.
  * `produceCachedData` {`boolean`} When `true` and no `cachedData` is present, V8 will attempt to produce code cache data for `code`. Upon success, a `Buffer` with V8's code cache data will be produced and stored in the `cachedData` property of the returned `vm.Script` instance. The `cachedDataProduced` value will be set to either `true` or `false` depending on whether code cache data is produced successfully. This option is **deprecated** in favor of `script.createCachedData()`. **Default:** `false`.
  * `importModuleDynamically` {`Function`|`vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER`} Used to specify how the modules should be loaded during the evaluation of this script when `import()` is called. This option is part of the experimental modules API. We do not recommend using it in a production environment.

If `options` is a string, then it specifies the filename.

Creating a new `vm.Script` object compiles `code` but does not run it. The compiled `vm.Script` can be run later multiple times. The `code` is not bound to any global object; rather, it is bound before each run, just for that run.

## `script.cachedDataRejected`

* Type: {`boolean`|`undefined`}

When `cachedData` is supplied to create the `vm.Script`, this value will be set to either `true` or `false` depending on acceptance of the data by V8. Otherwise the value is `undefined`.

## `script.createCachedData()`

* Returns: {`Buffer`}

Creates a code cache that can be used with the `Script` constructor's `cachedData` option. Returns a `Buffer`. This method may be called at any time and any number of times.

The code cache of the `Script` doesn't contain any JavaScript observable states. The code cache is safe to be saved along side the script source and used to construct new `Script` instances multiple times.

Functions in the `Script` source can be marked as lazily compiled and they are not compiled at construction of the `Script`. These functions are going to be compiled when they are invoked the first time. The code cache serializes the metadata that V8 currently knows about the `Script` that it can use to speed up future compilations.

```ts
const script = new vm.Script(`
function add(a, b) {
  return a + b;
}

const x = add(1, 2);
`);

const cacheWithoutAdd = script.createCachedData();
// In `cacheWithoutAdd` the function `add()` is marked for full compilation upon invocation.

script.runInThisContext();

const cacheWithAdd = script.createCachedData();
// `cacheWithAdd` contains fully compiled function `add()`.
```

## `script.runInContext(contextifiedObject[, options])`

* `contextifiedObject` {`Object`} A contextified object as returned by the `vm.createContext()` method.
* `options` {`Object`}
  - `displayErrors` {`boolean`} When `true`, if an `Error` occurs while compiling the `code`, the line of code causing the error is attached to the stack trace. **Default:** `true`.
  - `timeout` {`integer`} Specifies the number of milliseconds to execute `code` before terminating execution. If execution is terminated, an `Error` will be thrown. This value must be a strictly positive integer.
  - `breakOnSigint` {`boolean`} If `true`, receiving `SIGINT` (<kbd>Ctrl</kbd>+<kbd>C</kbd>) will terminate execution and throw an `Error`. Existing handlers for the event that have been attached via `process.on('SIGINT')` are disabled during script execution, but continue to work after that. **Default:** `false`.
* Returns: {`any`} the result of the very last statement executed in the script.

Runs the compiled code contained by the `vm.Script` object within the given `contextifiedObject` and returns the result. Running code does not have access to local scope.

The following example compiles code that increments a global variable, sets the value of another global variable, then execute the code multiple times. The globals are contained in the `context` object.

```ts
import { createContext, Script } from 'node:vm';

const context = {
  animal: 'cat',
  count: 2,
};

const script = new Script('count += 1; name = "kitty";');

createContext(context);
for (let i = 0; i < 10; ++i) {
  script.runInContext(context);
}

console.log(context);
// Prints: { animal: 'cat', count: 12, name: 'kitty' }
```

Using the `timeout` or `breakOnSigint` options will result in new event loops and corresponding threads being started, which have a non-zero performance overhead.

## `script.runInNewContext([contextObject[, options]])`

- `contextObject` {`Object`|`vm.constants.DONT_CONTEXTIFY`|`undefined`} Either `vm.constants.DONT_CONTEXTIFY` or an object that will be contextified. If `undefined`, an empty contextified object will be created for backwards compatibility.
- `options` {`Object`}
  * `displayErrors` {`boolean`} When `true`, if an `Error` occurs while compiling the `code`, the line of code causing the error is attached to the stack trace. **Default:** `true`.
  * `timeout` {`integer`} Specifies the number of milliseconds to execute `code` before terminating execution. If execution is terminated, an `Error` will be thrown. This value must be a strictly positive integer.
  * `breakOnSigint` {`boolean`} If `true`, receiving `SIGINT` (<kbd>Ctrl</kbd>+<kbd>C</kbd>) will terminate execution and throw an `Error`. Existing handlers for the event that have been attached via `process.on('SIGINT')` are disabled during script execution, but continue to work after that. **Default:** `false`.
  * `contextName` {`string`} Human-readable name of the newly created context. **Default:** `'VM Context i'`, where `i` is an ascending numerical index of the created context.
  * `contextOrigin` {`string`} Origin corresponding to the newly created context for display purposes. The origin should be formatted like a URL, but with only the scheme, host, and port (if necessary), like the value of the `url.origin` property of a `URL` object. Most notably, this string should omit the trailing slash, as that denotes a path. **Default:** `''`.
  * `contextCodeGeneration` {`Object`}
    * `strings` {`boolean`} If set to false any calls to `eval` or function constructors (`Function`, `GeneratorFunction`, etc) will throw an `EvalError`. **Default:** `true`.
    * `wasm` {`boolean`} If set to false any attempt to compile a WebAssembly module will throw a `WebAssembly.CompileError`. **Default:** `true`.
  * `microtaskMode` {`string`} If set to `afterEvaluate`, microtasks (tasks scheduled through `Promise`s and `async function`s) will be run immediately after the script has run. They are included in the `timeout` and `breakOnSigint` scopes in that case.
- Returns: {`any`} the result of the very last statement executed in the script.

This method is a shortcut to `script.runInContext(vm.createContext(options), options)`. It does several things at once:

1. Creates a new context.
2. If `contextObject` is an object, contextifies it with the new context. If  `contextObject` is undefined, creates a new object and contextifies it. If `contextObject` is `vm.constants.DONT_CONTEXTIFY`, don't contextify anything.
3. Runs the compiled code contained by the `vm.Script` object within the created context. The code does not have access to the scope in which this method is called.
4. Returns the result.

The following example compiles code that sets a global variable, then executes the code multiple times in different contexts. The globals are set on and contained within each individual `context`.

```ts
import { constants, Script } from 'node:vm';

const script = new Script('globalVar = "set"');

const contexts = [{}, {}, {}];
contexts.forEach((context) => {
  script.runInNewContext(context);
});

console.log(contexts);
// Prints: [{ globalVar: 'set' }, { globalVar: 'set' }, { globalVar: 'set' }]

// This would throw if the context is created from a contextified object.
// constants.DONT_CONTEXTIFY allows creating contexts with ordinary global objects that can be frozen.
const freezeScript = new Script('Object.freeze(globalThis); globalThis;');
const frozenContext = freezeScript.runInNewContext(constants.DONT_CONTEXTIFY);
```

## `script.runInThisContext([options])`

- `options` {`Object`}
  * `displayErrors` {`boolean`} When `true`, if an `Error` occurs while compiling the `code`, the line of code causing the error is attached to the stack trace. **Default:** `true`.
  * `timeout` {`integer`} Specifies the number of milliseconds to execute `code` before terminating execution. If execution is terminated, an `Error` will be thrown. This value must be a strictly positive integer.
  * `breakOnSigint` {`boolean`} If `true`, receiving `SIGINT` (<kbd>Ctrl</kbd>+<kbd>C</kbd>) will terminate execution and throw an `Error`. Existing handlers for the event that have been attached via `process.on('SIGINT')` are disabled during script execution, but continue to work after that. **Default:** `false`.
- Returns: {`any`} the result of the very last statement executed in the script.

Runs the compiled code contained by the `vm.Script` within the context of the current `global` object. Running code does not have access to local scope, but _does_ have access to the current `global` object.

The following example compiles code that increments a `global` variable then executes that code multiple times:

```ts
import { Script } from 'node:vm';

global.globalVar = 0;

const script = new Script('globalVar += 1', { filename: 'myfile.vm' });

for (let i = 0; i < 1000; ++i) {
  script.runInThisContext();
}

console.log(globalVar);
// 1000
```

## `script.sourceMapURL`

* Type: {`string`|`undefined`}

When the script is compiled from a source that contains a source map magic comment, this property will be set to the URL of the source map.

```ts
import vm from 'node:vm';

const script = new vm.Script(`
function myFunc() {}
//# sourceMappingURL=sourcemap.json
`);

console.log(script.sourceMapURL);
// Prints: sourcemap.json
```
