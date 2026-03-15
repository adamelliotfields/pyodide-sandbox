# pyodide-sandbox

Building a command-line interface (CLI) for Pyodide to provide a filesystem sandboxed environment for running untrusted Python code in the terminal.

## Tree

```
.
├── AGENTS.md
├── README.md
├── biome.json
├── notes
│   ├── commander.md
│   ├── node-sea.md
│   ├── permissions.md
│   └── pyodide.md
├── package.json
├── rolldown.config.ts
├── sea-config.json
├── src
│   ├── main.ts
│   ├── pyodide.ts
│   ├── run.ts
│   └── utils.ts
└── tsconfig.json
```

## Usage

```
Usage: pyodide [options] [code]

A Python sandbox powered by Pyodide

Arguments:
  code                    python code to execute

Options:
  --cdn-url <url>         override the default jsDelivr CDN URL
  -e, --env <KEY=VALUE>   set environment variables in the sandbox (default: {})
  --list-packages         list installed Pyodide packages
  -p, --packages <names>  install comma-separated packages before running
  -v, --version           output the version number
  -h, --help              display help for command
```

## Type Checking

Run `pnpm check` to check for TypeScript errors.

Use `tsgo` not `tsc` otherwise.

## Formatting

Use StandardJS style:

```yaml
printWidth: 100
tabWidth: 2
useTabs: false
semi: false
singleQuote: true
quoteProps: as-needed
trailingComma: none
bracketSpacing: true
objectWrap: preserve
arrowParens: always
```

## Linting

Run `pnpm lint:fix` to automatically fix errors with Biome.

## Testing

No tests have been implemented yet. Prefer `node:test` and `node:assert/strict`.

## Building

Because there is no file system in a Node executable, we have to copy the assets to `/tmp/pyodide` on first launch.

We support running `node src/main.ts` directly for development, and `./dist/pyodide` for production. We don't support running the CJS bundle directly, or installing via `npm i -g`. Users are expected to clone the repo and build for their OS.

At build time, we use a custom Rolldown `copy` plugin to transfer the Pyodide assets to `dist`. The `pnpm build:cjs` script bundles `dist/pyodide.cjs` and `npm run build:bin` injects the bundle into the executable. Note that we have to use `npm` for the final step, as `pnpm` doesn't set `$npm_node_execpath`.
