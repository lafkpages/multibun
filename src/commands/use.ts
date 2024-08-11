import { Command, program } from "@commander-js/extra-typings";
import { stat, unlink, link } from "node:fs/promises";
import { join } from "node:path";
import { bunBinDir, multibunInstallDir } from "../config";
import { validateBunVersion } from "../install";
import { resolveVersion } from "../github";

export default new Command("use")
  .description("Link the global bun executable to a specific version")
  .option(
    "--overwrite",
    "Overwrite the global bun executable even if it is not a symlink"
  )
  .argument("<version>", "The version to use")
  .action(async (version, options) => {
    version = await resolveVersion(version);
    validateBunVersion(version);

    const globalBunExec = join(bunBinDir, "bun");
    const stats = await stat(globalBunExec);

    if (stats.isFile() && !stats.isSymbolicLink() && !options.overwrite) {
      program.error(
        `\
Global bun executable seems to be a normal Bun installation, exiting to avoid overwriting it.

Hint: use '--overwrite' to force the operation.`
      );
    }

    const newBunExec = Bun.file(
      join(multibunInstallDir, version, "bin", "bun")
    );

    if (!(await newBunExec.exists())) {
      program.error(`\
Version ${version} is not installed.

Hint: try running 'multibun install ${version}' to install it.`);
    }

    await unlink(globalBunExec);
    await link(newBunExec.name!, globalBunExec);
  });
