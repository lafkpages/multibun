import { Command, Option } from "@commander-js/extra-typings";
import { multibunInstallDir } from "../config";
import { getInstalledVersions } from "../install";
import { join } from "node:path";

export default new Command("list")
  .alias("ls")
  .description("List all installed Bun versions")
  .addOption(
    new Option("-s, --sort <order>", "Sort versions in a given order")
      .choices(["ascending", "descending", "none"] as const)
      .default("ascending")
  )
  .option("-p, --path", "Show the path to the installed version")
  .action(async (options) => {
    const bunInstallations = await getInstalledVersions(
      options.sort === "none"
        ? null
        : options.sort === "descending"
        ? false
        : true
    );

    for (const [bunInstallation, version] of bunInstallations) {
      if (options.path) {
        console.log(
          `${join(multibunInstallDir, bunInstallation)}:\t${version}`
        );
      } else {
        console.log(version);
      }
    }
  });
