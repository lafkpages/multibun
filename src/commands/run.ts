import { Command, Option, program } from "@commander-js/extra-typings";
import { log } from "..";
import { join } from "node:path";
import { getInstalledVersions, validateBunVersion } from "../install";
import { versionToTagName } from "../github";
import { runReportGenerators, type RunReportResult } from "../reports";
import { multibunInstallDir } from "../config";

const command = new Command<
  [],
  { [key in (typeof runReportGenerators)[number]["key"]]?: string | boolean }
>("run")
  .description("Run several Bun versions with the given arguments")
  .option("-f, --from <version>", "Lower bound of version range to run")
  .option("-t, --to <version>", "Upper bound of version range to run")
  .addOption(
    new Option("-V <version>", "Specific version to run").conflicts([
      "from",
      "to",
    ])
  )
  .option(
    "-n, --no-output",
    "Do not show stdout/stderr of Bun processes",
    true
  );

for (const generator of runReportGenerators) {
  command.option(`${generator.flag} [file]`, generator.description);
}

command.action(async function (this: Command, options) {
  if (options.from) {
    validateBunVersion(versionToTagName(options.from));
  }
  if (options.to) {
    validateBunVersion(versionToTagName(options.to));
  }
  if (options.V) {
    validateBunVersion(versionToTagName(options.V));
  }

  const bunInstallations = await getInstalledVersions();

  const results: RunReportResult[] = [];
  const isGeneratingReport = runReportGenerators.some(
    (generator) => options[generator.key]
  );

  let hasRunAnyVersion = false;

  for await (const [bunInstallation, version] of bunInstallations) {
    log.debug("Found Bun installation:", bunInstallation);

    if (options.from && Bun.semver.order(version, options.from) === -1) {
      continue;
    }

    if (options.to && Bun.semver.order(version, options.to) === 1) {
      continue;
    }

    if (options.V && Bun.semver.order(version, options.V)) {
      continue;
    }

    log.info("Executing Bun version:", version);

    const stdio = options.output
      ? "inherit"
      : isGeneratingReport
      ? "pipe"
      : "ignore";

    const startTime = performance.now();
    const bunProcess = Bun.spawn({
      cmd: [join(multibunInstallDir, bunInstallation), ...this.args],
      stdin: stdio,
      stdout: stdio,
      stderr: stdio,
    });

    await bunProcess.exited;

    const endTime = performance.now();
    const time = endTime - startTime;

    log.debug("Bun process took", time, "ms");
    if (bunProcess.exitCode === null) {
      log.info("Bun process crashed or killed");
    } else {
      log.info("Bun process exited with code:", bunProcess.exitCode);
    }

    // only keep track of the results if we are generating a report
    if (isGeneratingReport) {
      results.push({
        version,
        exitCode: bunProcess.exitCode,
        time,

        stdout: bunProcess.stdout
          ? await Bun.readableStreamToText(bunProcess.stdout)
          : undefined,
        stderr: bunProcess.stderr
          ? await Bun.readableStreamToText(bunProcess.stderr)
          : undefined,
      });
    }

    hasRunAnyVersion = true;
  }

  if (!hasRunAnyVersion) {
    program.error("No Bun versions matched");
  }

  if (isGeneratingReport) {
    for (const generator of runReportGenerators) {
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
