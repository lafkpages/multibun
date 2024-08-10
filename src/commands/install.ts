import { join } from "node:path";
import { Command, Option, program } from "commander";
import { installBunVersionsInRange } from "../install";
import { bunTargets, type BunTarget } from "../target";
import { log } from "..";
import { multibunInstallDir } from "../config";

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
  .option(
    "-d, --install-dir <installDir>",
    "Directory to install Bun versions in"
  )
  .action(
    async (options: {
      from?: string;
      to?: string;
      target?: BunTarget;
      installDir?: string;
    }) => {
      const installDir = options.installDir || multibunInstallDir;

      if (!options.from && !options.to) {
        program.error(
          "Neither --from nor --to was provided, this is probably a mistake, exiting."
        );
      }

      await installBunVersionsInRange({
        versionMin: options.from,
        versionMax: options.to,
        installDir(version) {
          return join(installDir, version);
        },
        target: options.target,
        onInstall(version) {
          log.info(`Installed Bun version: ${version}`);
        },
        onError(err) {
          log.error("Failed to install Bun version:", err);
        },
      });
    }
  );
