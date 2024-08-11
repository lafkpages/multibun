import type { RunReportResult } from "../reports";

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Command, Option, program } from "@commander-js/extra-typings";

import { log } from "..";
import { multibunInstallDir } from "../config";
import { versionToTagName } from "../github";
import { getInstalledVersions, validateBunVersion } from "../install";
import { runReportGenerators } from "../reports";
import { compareSemver } from "../semver";
import { childProcessFinished, streamToString } from "../utils";

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
    ]),
  )
  .option("-n, --no-output", "Do not show stdout/stderr of Bun processes", true)
  .option("-x, --execute <command>", "Execute a command with each version");

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
    (generator) => options[generator.key],
  );

  let hasRunAnyVersion = false;

  for await (const [bunInstallation, version] of bunInstallations) {
    log.debug("Found Bun installation:", bunInstallation);

    if (options.from && compareSemver(version, options.from) === -1) {
      continue;
    }

    if (options.to && compareSemver(version, options.to) === 1) {
      continue;
    }

    if (options.V && compareSemver(version, options.V)) {
      continue;
    }

    if (options.execute) {
      log.info("Executing command with Bun version:", version);
    } else {
      log.info("Executing Bun version:", version);
    }

    const stdio = options.output
      ? "inherit"
      : isGeneratingReport
        ? "pipe"
        : "ignore";

    const startTime = performance.now();
    const child = spawn(
      options.execute || join(multibunInstallDir, bunInstallation),
      this.args,
      {
        stdio,
        env: {
          ...process.env,

          // make sure the current version is first in the PATH
          PATH: `${join(multibunInstallDir, bunInstallation, "..")}:${process.env.PATH}`,

          BUN_VERSION: version,
        },
        shell: true,
      },
    );

    const exitCode = await childProcessFinished(child);

    const endTime = performance.now();
    const time = endTime - startTime;

    log.debug("Process took", time, "ms");
    if (exitCode === null) {
      log.info("Process crashed or killed");
    } else {
      log.info("Process exited with code:", child.exitCode);
    }

    // only keep track of the results if we are generating a report
    if (isGeneratingReport) {
      results.push({
        version,
        exitCode: child.exitCode,
        time,

        stdout: child.stdout ? await streamToString(child.stdout) : undefined,
        stderr: child.stderr ? await streamToString(child.stderr) : undefined,
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
        await writeFile(generatorOption, report);
      } else {
        console.log(report);
      }
    }
  }
});

export default command;
