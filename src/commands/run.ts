import { Command } from "commander";
import { log } from "..";
import { join } from "node:path";
import { validateBunVersion } from "../install";
import { versionToTagName } from "../github";
import { reportGenerators } from "../reports";

const command = new Command("run")
  .description("Run several Bun versions with the given arguments")
  .option("-f, --from <version>", "Lower bound of version range to run")
  .option("-t, --to <version>", "Upper bound of version range to run")
  .option("-n, --no-output", "Do not show stdout/stderr of Bun processes", true)
  .requiredOption(
    "-d, --install-dir <installDir>",
    "Directory containing Bun versions to run"
  );

for (const generator of reportGenerators) {
  command.option(`${generator.flag} [file]`, generator.description);
}

command.action(async function (
  this: Command,
  options: {
    from?: string;
    to?: string;
    output: boolean;
    installDir: string;
  } & {
    [key in (typeof reportGenerators)[number]["key"]]?: string | boolean;
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
    .sort(([, versionA], [, versionB]) => Bun.semver.order(versionA, versionB));

  const results: [string, string][] = [];
  const isGeneratingReport = reportGenerators.some(
    (generator) => options[generator.key]
  );

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

    // only keep track of the results if we are generating a report
    if (isGeneratingReport) {
      results.push([version, bunProcess.exitCode?.toString() ?? "K"]);
    }
  }

  if (isGeneratingReport) {
    for (const generator of reportGenerators) {
      const generatorOption = options[generator.key];
      if (!generatorOption) {
        continue;
      }

      const report = await generator.generate(results);

      if (typeof generatorOption === "string") {
        await Bun.write(generatorOption, report);
      } else {
        console.log(report);
      }
    }
  }
});

export default command;
