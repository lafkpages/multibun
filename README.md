# Multibun

A version manager for [Bun](https://bun.sh).

## Installation

Multibun is a command line tool that can be installed globally using npm (or your preferred package manager).

```sh
npm install -g multibun
```

## Usage

Multibun is a command line tool that can be used to manage multiple versions of Bun. It can be used to install, list, switch between and run different versions of Bun.

### Installing Bun Versions

To install a specific version of Bun, use the `install` command followed by the version number.

```sh
multibun install 1.0.0
```

You can also install the latest version of Bun by specifying the `latest` keyword.

```sh
multibun install latest
```

To download a range of versions, use the `--from` and `--to` flags.

```sh
# install all versions after v0.6.0
multibun install --from 0.6.0
```

```sh
# install all versions between v0.6.0 and v1.0.0
multibun install --from 0.6.0 --to 1.0.0
```

### Listing Versions

To list all installed versions of Bun, use the `list` command (or `ls` for short).

```sh
multibun list
```

This will display a list of all the versions of Bun that are currently installed.

To list all versions of Bun available to install, use the `list-remote` command (or `lsr` for short).

```sh
multibun list-remote
```

### Switching Between Versions

To switch between installed versions of Bun, use the `use` command followed by the version number.

```sh
multibun use 1.0.0
```

This will update the `bun` executable to point to the specified version.

**Note:** if you had previously installed Bun globally, you may need to uninstall it first, or use
the `--overwrite` flag to overwrite the existing installation. This is only necessary the first time
when switching from a global installation to a version managed by Multibun.

```sh
multibun use 1.0.0 --overwrite
```

### Running Bun

If you want to run a specific version of Bun, you can use the `use` command as described above, and
then run the `bun` command as you normally would.

```sh
multibun use 1.1.0
bun --version # should output 1.1.0
```

Alternatively, you can use the `run` command to run a specific version of Bun without switching the
global version.

```sh
multibun run -V 1.1.0 -- --version # should output 1.1.0
```

The most notable use case for the `run` command, however, is that it can be used to run several
versions of Bun at once.

```sh
multibun run --from 1.1.0 --to 1.1.10 -- --revision
```

This can be useful for testing libraries or applications against multiple versions of Bun. It could also
aid in debugging issues that may be specific to a certain version of Bun.

Multibun can also generate pretty reports with the results of the Bun processes in a `run` command.

```sh
multibun run --from 1.1.0 --to 1.1.10 -n --html myreport.html -- --revision
```
