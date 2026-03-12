# Commander.js

## Terminology

The command line arguments are made up of options, option-arguments, commands, and command-arguments.

| Term | Explanation |
| --- | --- |
| option | an argument which is a `-` followed by a character, or `--` followed by a word (or hyphenated words), like `-s` or `--short` |
| option-argument| some options can take an argument |
| command | a program or command can have subcommands |
| command-argument | argument for the command (and not an option or option-argument) |

For example:

```sh
my-utility command -o --option option-argument command-argument-1 command-argument-2
```

In other references options are sometimes called flags, and command-arguments are sometimes called positional arguments or operands.

## Parsing life cycle

The processing starts with an array of args. Each command processes and removes the options it understands, and passes the remaining args to the next subcommand. The final command calls the action handler.

Starting with top-level command (program):

- parse options: parse recognised options (for this command) and remove from args
- parse env: look for environment variables (for this command)
- process implied: set any implied option values (for this command)
- if the first arg is a subcommand
  * call `preSubcommand` hooks
  * pass remaining arguments to subcommand, and process same way

Once the final (leaf) command is reached:

- check for missing mandatory options
- check for conflicting options
- check for unknown options
- process remaining args as command-arguments
- call `preAction` hooks
- call action handler
- call `postAction` hooks

## Parsing ambiguity

There is a potential downside to be aware of. If a command has both command-arguments and options with varying option-arguments, this introduces a parsing ambiguity which may affect the user of your program. Commander looks for option-arguments first, but the user may intend the argument following the option as a command or command-argument.

```js
program
  .name('cook')
  .argument('[technique]')
  .option('-i, --ingredient [ingredient]', 'add cheese or given ingredient')
  .action((technique, options) => {
    console.log(`technique: ${technique}`)
    const ingredient = (options.ingredient === true) ? 'cheese' : options.ingredient
    console.log(`ingredient: ${ingredient}`)
  })
program.parse()
```

```sh
$ cook scrambled
# technique: scrambled
# ingredient: undefined

$ cook -i
# technique: undefined
# ingredient: cheese

$ cook -i egg
# technique: undefined
# ingredient: egg

$ cook -i scrambled  # oops
# technique: undefined
# ingredient: scrambled
```

The explicit way to resolve this is use `--` to indicate the end of the options and option-arguments:

```sh
$ node cook.js -i -- scrambled
# technique: scrambled
# ingredient: cheese
```

If you want to avoid your users needing to learn when to use `--`, there are a few approaches you could take.

## Combining short options and options taking arguments

Multiple boolean short options can be combined after a single `-`, like `ls -al`. You can also include just a single short option which might take a value, as any following characters will be taken as the value.

This means that by default you can not combine short options which may take an argument:

```ts
program
  .name('collect')
  .option('-o, --other [count]', 'other serving(s)')
  .option('-v, --vegan [count]', 'vegan serving(s)')
  .option('-l, --halal [count]', 'halal serving(s)')
program.parse(process.argv)

const opts = program.opts()
if (opts.other) console.log(`other servings: ${opts.other}`)
if (opts.vegan) console.log(`vegan servings: ${opts.vegan}`)
if (opts.halal) console.log(`halal servings: ${opts.halal}`)
```

```sh
$ collect -o 3
# other servings: 3

$ collect -o3
# other servings: 3

$ collect -l -v
# vegan servings: true
# halal servings: true

$ collect -lv
# halal servings: v
```

If you wish to use options taking varying arguments as boolean options, you need to specify them separately.

```sh
$ collect -a -v -l
# any servings: true
# vegan servings: true
# halal servings: true
```

## Help in Depth

The built-in help is formatted using the Help class. You can configure the Help behaviour by modifying data properties and methods using `.configureHelp()`, or by subclassing using `.createHelp()` if you prefer.

### Data Properties

The data properties are:

- `helpWidth`: specify the wrap width, useful for unit tests
- `minWidthToWrap`: specify required width to allow wrapping (default 40)
- `showGlobalOptions`: show a section with the global options from the parent command(s)
- `sortSubcommands`: sort the subcommands alphabetically
- `sortOptions`: sort the options alphabetically

### Stringify and Style

The `Help` object has narrowly focused methods to allow customising the displayed help. The stringify routines take an object (`Command` or `Option` or `Argument`) and produce a string. For example you could change the way subcommands are listed:

```ts
program.configureHelp({
  subcommandTerm: (cmd) => cmd.name() // just show the name instead of usage
})
```

The style routines take just a string. For example to make the titles bold:

```ts
import { styleText } from 'node:util'
program.configureHelp({
   styleTitle: (str) => styleText('bold', str)
})
```

There is built-in support for detecting whether the output has colors, and respecting environment variables for `NO_COLOR`, `FORCE_COLOR`, and `CLIFORCE_COLOR`. The style routines always get called and color is stripped afterwards if needed using `Command.configureOutput().stripColor()`.

### Layout

Utility methods which control the layout include `padWidth`, `boxWrap`, and `formatItem`. These can be overridden to change the layout or replace with an alternative implementation.
