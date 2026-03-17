# pyodide-sandbox

Building a command-line interface (CLI) for Pyodide to provide a sandboxed environment for running untrusted Python code in the terminal.

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
├── src
│   ├── main.ts
│   ├── pyodide.ts
│   └── utils.ts
└── tsconfig.json
```

## Usage

```
Usage: pyodide [options] [code]

A Python sandbox powered by Pyodide

Arguments:
  code                      python code to execute

Options:
  -e, --env <key=value>     set environment variables in the sandbox (default: {})
  --list-packages           list installed Pyodide packages
  -m, --mount <host:guest>  mount a host directory into the sandbox
  -p, --packages <names>    load comma-separated packages before running
  -v, --version             output the version number
  -h, --help                display help for command```

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

Run `pnpm test` to execute the test suite with `node --test`.

## Building

We support running `node src/main.ts` directly for development, and `./dist/pyodide` for production. We don't support running the CJS bundle directly, or installing via `npm i -g`. Users are expected to clone the repo and build for their OS. See [rolldown.config.ts](./rolldown.config.ts).
