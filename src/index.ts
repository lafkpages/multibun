import { program, Option } from "@commander-js/extra-typings";
import { version } from "../package.json";
import { commands } from "./commands";
import log from "loglevel";

log.setDefaultLevel(log.levels.INFO);
log.resetLevel();

export { log };

program
  .name("multibun")
  .version(version, "--version")
  .addOption(
    new Option("-v, --verbose", "Enable verbose logging").conflicts("--quiet")
  )
  .addOption(
    new Option("-q, --quiet", "Disable logging").conflicts("--verbose")
  )
  .hook("preAction", (thisCommand) => {
    const { verbose, quiet } = thisCommand.opts();

    if (verbose) {
      log.enableAll();
    }

    if (quiet) {
      log.disableAll();
    }
  });

for (const command of commands) {
  program.addCommand(command);
}

program.parse();
