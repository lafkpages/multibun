import { join } from "node:path";
import {
  Argument,
  Command,
  Option,
  program,
} from "@commander-js/extra-typings";
import { installBunVersion, installBunVersionsInRange } from "../install";
import { bunTargets } from "../target";
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
  .addArgument(new Argument("[version]", "Version to install"))
  .action(async (version, options) => {
    const installDir = options.installDir || multibunInstallDir;

    if (!options.from && !options.to && !version) {
      program.error(
        "Neither --from nor --to nor -V was provided, this is probably a mistake"
      );
    }

    if ((options.from || options.to) && version) {
      program.error(
        "Cannot specify both a version range and a single version to install"
      );
    }

    function onInstall(version: string) {
      log.info(`Installed Bun version: ${version}`);
    }

    function onError(err: unknown) {
      log.error("Failed to install Bun version:", err);
    }

    if (version) {
      await installBunVersion({
        version,
        installDir: join(installDir, version),
        target: options.target,
      }).catch(onError);

      onInstall(version);
    } else {
      await installBunVersionsInRange({
        versionMin: options.from,
        versionMax: options.to,
        installDir(version) {
          return join(installDir, version);
        },
        target: options.target,
        onInstall,
        onError,
      });
    }
  });
