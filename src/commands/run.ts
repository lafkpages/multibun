import { stringify } from "csv-stringify/sync";
import { Command, Option } from "commander";
import { log } from "..";
import { join } from "node:path";
import { validateBunVersion } from "../install";
import { versionToTagName } from "../github";

export default new Command("run")
  .description("Run several Bun versions with the given arguments")
  .option("-f, --from <version>", "Lower bound of version range to run")
  .option("-t, --to <version>", "Upper bound of version range to run")
  .option("-n, --no-output", "Do not show stdout/stderr of Bun processes", true)
  .requiredOption(
    "-d, --install-dir <installDir>",
    "Directory containing Bun versions to run"
  )
  .addOption(
    new Option(
      "--csv [file]",
      "Output results in CSV format, optionally specifying a file to write to"
    )
  )
  .action(async function (
    this: Command,
    options: {
      from?: string;
      to?: string;
      output: boolean;
      installDir: string;
      csv?: string | boolean;
    }
  ) {
    if (options.from) {
      validateBunVersion(versionToTagName(options.from));
    }
    if (options.to) {
      validateBunVersion(versionToTagName(options.to));
    }

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

    const results: [string, string][] = [];

    for await (const [bunInstallation, version] of bunInstallations) {
      log.debug("Found Bun installation:", bunInstallation);

      if (options.from && Bun.semver.order(version, options.from) === -1) {
        continue;
      }

      if (options.to && Bun.semver.order(version, options.to) === 1) {
        continue;
      }

      log.info("Executing Bun version:", version);

      const stdio = options.output ? "inherit" : "ignore";

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

      // only keep track of the results if we are outputting in CSV format
      if (options.csv) {
        results.push([version, bunProcess.exitCode?.toString() ?? "K"]);
      }
    }

    if (options.csv) {
      const csv = stringify(results, {
        header: true,
        columns: ["version", "exitCode"],
      });

      if (typeof options.csv === "string") {
        Bun.write(options.csv, csv);
      } else {
        console.log(csv);
      }
    }
  });
