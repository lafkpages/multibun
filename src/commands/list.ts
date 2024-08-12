import { join } from "node:path";

import { Command, Option } from "@commander-js/extra-typings";

import { log } from "..";
import { multibunInstallDir } from "../config";
import { getCurrentVersion, getInstalledVersions } from "../install";

export default new Command("list")
  .alias("ls")
  .description("List all installed Bun versions")
  .addOption(
    new Option("-s, --sort <order>", "Sort versions in a given order")
      .choices(["ascending", "descending", "none"] as const)
      .default("ascending"),
  )
  .option("-p, --path", "Show the path to the installed version")
  .action(async (options) => {
    const bunInstallations = await getInstalledVersions(
      options.sort === "none"
        ? null
        : options.sort === "descending"
          ? false
          : true,
    );

    if (!bunInstallations.length) {
      log.info(`\
No Bun versions are installed.

Hint: use 'multibun list-remote' to view available versions, and 'multibun install' to install them.`);
      return;
    }

    const currentVersion = await getCurrentVersion(false).catch((err) => {
      log.warn("Warning:", err.message);
    });

    for (const [bunInstallation, version] of bunInstallations) {
      const isCurrent =
        version === currentVersion?.version ? "\t(current)" : "";

      if (options.path) {
        console.log(
          `- ${join(
            multibunInstallDir,
            bunInstallation,
          )}:\t${version}${isCurrent}`,
        );
      } else {
        console.log(`- ${version}${isCurrent}`);
      }
    }
  });
