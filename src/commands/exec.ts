import { Command } from "commander";
import { log } from "..";
import { join } from "node:path";

export default new Command("exec")
  .description("Execute several Bun versions with the given arguments")
  .option(
    "-n, --no-output",
    "Do not show stdout/stderr of Bun processes",
    false
  )
  .requiredOption(
    "-d, --install-dir <installDir>",
    "Directory containing Bun versions to execute"
  )
  .action(async function (
    this: Command,
    options: { installDir: string; noOutput: boolean }
  ) {
    const bunInstallations = (
      await Array.fromAsync(
        new Bun.Glob("bun-v?*/bin/bun").scan({
          cwd: options.installDir,
          onlyFiles: false,
        })
      )
    )
      .map((bunInstallation) => [
        bunInstallation,
        bunInstallation.match(/^bun-v(.+)\/bin\/bun$/)![1],
      ])
      .sort(([, versionA], [, versionB]) =>
        Bun.semver.order(versionA, versionB)
      );

    for await (const [bunInstallation, version] of bunInstallations) {
      log.debug("Found Bun installation:", bunInstallation);
      log.info("Executing Bun version:", version);

      const stdio = options.noOutput ? "ignore" : "inherit";

      const bunProcess = Bun.spawn({
        cmd: [join(options.installDir, bunInstallation), ...this.args],
        stdin: stdio,
        stdout: stdio,
        stderr: stdio,
      });

      await bunProcess.exited;

      if (bunProcess.exitCode === null) {
        log.info("Bun process crashed or killed");
      } else {
        log.info("Bun process exited with code:", bunProcess.exitCode);
      }
    }
  });
