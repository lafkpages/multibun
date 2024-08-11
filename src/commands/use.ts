import { access, constants, symlink, unlink } from "node:fs/promises";
import { join } from "node:path";

import { Command, program } from "@commander-js/extra-typings";

import { log } from "..";
import { bunExec, multibunInstallDir } from "../config";
import { resolveVersion } from "../github";
import {
  getCurrentVersion,
  isBunVersionValid,
  validateBunVersion,
} from "../install";

const overwriteMessage = `\

Hint: use '--overwrite' to force the operation.`;

export default new Command("use")
  .description("Link the global bun executable to a specific version")
  .option(
    "--overwrite",
    "Overwrite the global bun executable even if it is not a symlink",
  )
  .argument("<version>", "The version to use")
  .action(async (version, options) => {
    version = await resolveVersion(version);
    validateBunVersion(version);

    const currentVersion = await getCurrentVersion(false);

    if (!currentVersion && !options.overwrite) {
      program.error(
        "Global bun executable seems to be a normal Bun installation, exiting to avoid overwriting it." +
          overwriteMessage,
      );
    }

    if (currentVersion) {
      if (currentVersion.tagName === version) {
        log.info(`Version ${version} is already in use.`);
        return;
      }

      if (currentVersion) {
        log.debug("Current version:", currentVersion);
      }

      if (!isBunVersionValid(currentVersion.tagName)) {
        log.warn(
          "Global bun executable is managed by multibun, but the version is invalid.",
        );
      }
    }

    const newBunExec = join(multibunInstallDir, version, "bin", "bun");

    if (
      !(await access(newBunExec, constants.R_OK | constants.X_OK).catch(
        () => false,
      ))
    ) {
      program.error(`\
Version ${version} is not installed.

Hint: try running 'multibun install ${version}' to install it.`);
    }

    await unlink(bunExec);
    await symlink(newBunExec, bunExec, "file");
  });
