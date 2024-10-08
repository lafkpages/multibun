import { Argument, Command, Option } from "@commander-js/extra-typings";

import { log } from "..";
import { installBunVersion, installBunVersionsInRange } from "../install";
import { bunTargets } from "../target";

const command = new Command("install")
  .description("Install one or several versions of Bun")
  .option("-f, --from <version>", "Lower bound of version range to install")
  .option("-t, --to <version>", "Upper bound of version range to install")
  .addOption(
    new Option(
      "-T, --target <target>",
      "Platform target to install Bun versions for",
    ).choices(bunTargets),
  )
  .addArgument(new Argument("[version]", "Version to install"))
  .action(async (version, options) => {
    if (!options.from && !options.to && !version) {
      command.showHelpAfterError();
      command.error(
        "Neither --from nor --to nor -V was provided, this is probably a mistake",
      );
    }

    if ((options.from || options.to) && version) {
      command.error(
        "Cannot specify both a version range and a single version to install",
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
        target: options.target,
      }).catch(onError);

      onInstall(version);
    } else {
      await installBunVersionsInRange({
        versionMin: options.from,
        versionMax: options.to,
        target: options.target,
        onInstall,
        onError,
      });
    }
  });

export default command;
