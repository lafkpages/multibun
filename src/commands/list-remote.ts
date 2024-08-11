import { Command } from "@commander-js/extra-typings";

import { getAllReleases } from "../github";

export default new Command("list-remote")
  .alias("lsr")
  .description("List available Bun versions")
  .action(async () => {
    const releases = await getAllReleases();

    for (const release of releases) {
      console.log("-", release.tagName);
    }
  });
