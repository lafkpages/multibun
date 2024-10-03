import { rm } from "node:fs/promises";
import { join } from "node:path";

import { Command, program } from "@commander-js/extra-typings";

import { log } from "..";
import { multibunInstallDir } from "../config";
import { resolveVersion } from "../github";

export default new Command("uninstall")
  .alias("u")
  .description("Uninstall a Bun version")
  .argument("<version>", "The version to uninstall")
  .action(async (version) => {
    const tagName = await resolveVersion(version);
    const path = join(multibunInstallDir, tagName);

    log.debug(`Uninstalling version ${version} from ${path}`);

    try {
      await rm(path, {
        recursive: true,
      });
    } catch (e) {
      if (
        e instanceof Error &&
        (e as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        program.error(`Version ${version} is not installed`);
      }

      throw e;
    }
  });
