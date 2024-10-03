import { Command, Option, program } from "@commander-js/extra-typings";

import { log } from "..";
import { getAllReleases } from "../github";

export default new Command("list-remote")
  .alias("lsr")
  .description("List available Bun versions")
  .addOption(
    new Option(
      "-l, --limit <limit>",
      "Limit the number of versions to list. -1 will list all versions.",
    )
      .default(25)
      .argParser(parseInt),
  )
  .addOption(
    new Option("-a, --all", "List all versions.").implies({ limit: -1 }),
  )
  .action(async (options) => {
    if (options.limit === -1) {
      options.limit = Infinity;
    } else if (options.limit < 1) {
      program.error("Limit must be -1 or a positive number.");
    }

    const releases = await getAllReleases();

    for (let i = 0; i < Math.min(releases.length, options.limit); i++) {
      console.log("-", releases[i].tagName);
    }

    if (options.limit < releases.length) {
      console.log("...");

      log.info("\nHint: use --limit or --all to list more versions.");
    }
  });
