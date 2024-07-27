import { join } from "node:path";
import { Command, Option } from "commander";
import { installBunVersionsInRange } from "../install";
import { bunTargets, type BunTarget } from "../target";
import { log } from "..";

export default new Command("install")
  .description("Install all Bun versions in a given range")
  .option("-f, --from <version>", "Lower bound of version range to install")
  .option("-t, --to <version>", "Upper bound of version range to install")
  .addOption(
    new Option(
      "-T, --target <target>",
      "Platform target to install Bun versions for"
    ).choices(bunTargets)
  )
  .requiredOption(
    "-d, --install-dir <installDir>",
    "Directory to install Bun versions in"
  )
  .action(
    async (options: {
      from?: string;
      to?: string;
      target?: BunTarget;
      installDir: string;
    }) => {
      await installBunVersionsInRange({
        versionMin: options.from,
        versionMax: options.to,
        installDir(version) {
          return join(options.installDir, version);
        },
        target: options.target,
        onInstall(version) {
          log.info(`Installed Bun version: ${version}`);
        },
      });
    }
  );
