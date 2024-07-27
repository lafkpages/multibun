import { join } from "node:path";
import { mkdir, rename, chmod, rm } from "node:fs/promises";
import { getAllReleases, tagNameToVersion, versionToTagName } from "./github";
import { detectTarget, type BunTarget } from "./target";
import { log } from ".";

const allReleases = await getAllReleases();

export function validateBunVersion(tagName: string) {
  if (!allReleases.some((release) => release.tagName === tagName)) {
    throw new Error(`Invalid Bun version: ${tagName}`);
  }
}

export async function installBunVersion({
  version,
  installDir,
  target,
}: {
  version: string;
  installDir: string;
  target?: BunTarget;
}) {
  validateBunVersion(version);

  if (!target) {
    target = detectTarget();
  }
  const targetDownloadFile = Bun.file(
    join(__dirname, `../.cache/${version}-${target}.zip`)
  );

  let exeName = "bun";
  if (target.endsWith("-profile")) {
    exeName = "bun-profile";
  }

  const binDir = join(installDir, "bin");
  const exe = Bun.file(join(binDir, "bun"));

  if (await exe.exists()) {
    log.debug("Already installed:", version);
    return;
  }

  await mkdir(binDir, { recursive: true });

  if (await targetDownloadFile.exists()) {
    log.debug("Using cached:", version);
  } else {
    log.debug("Downloading:", version);

    const resp = await fetch(
      `https://github.com/oven-sh/bun/releases/download/${encodeURIComponent(
        version
      )}/bun-${encodeURIComponent(target)}.zip`
    );

    if (!resp.ok) {
      throw new Error(
        `Failed to download ${version} for ${target}: ${resp.statusText}`
      );
    }

    await Bun.write(targetDownloadFile, resp);
  }

  log.debug("Unzipping:", targetDownloadFile.name!, "to", binDir);

  const unzipProcess = Bun.spawn({
    cmd: ["unzip", "-oqd", binDir, targetDownloadFile.name!],
    stderr: "pipe",
  });

  if ((await unzipProcess.exited) !== 0) {
    throw new Error(
      `Failed to unzip ${version} for ${target}: exit code ${
        unzipProcess.exitCode
      }\n${await Bun.readableStreamToText(unzipProcess.stderr)}`
    );
  }

  const unzippedDir = join(binDir, `bun-${target}`);

  await rename(join(unzippedDir, exeName), exe.name!);

  await chmod(exe.name!, 0o755);

  await rm(unzippedDir, { recursive: true });
}

export async function installBunVersions({
  versions,
  installDir,
  target,
  onInstall,
}: {
  versions: string[];
  installDir: (version: string) => string;
  target?: BunTarget;
  onInstall?: (version: string) => void;
}) {
  for (const version of versions) {
    await installBunVersion({
      version,
      installDir: installDir(version),
      target,
    }).then(() => {
      onInstall?.(version);
    });
  }
}

export async function installBunVersionsInRange({
  versionMin,
  versionMax,
  installDir,
  target,
  onInstall,
}: {
  versionMin?: string;
  versionMax?: string;
  installDir: (version: string) => string;
  target?: BunTarget;
  onInstall?: (version: string) => void;
}) {
  if (versionMin) {
    validateBunVersion(versionToTagName(versionMin));
  }
  if (versionMax) {
    validateBunVersion(versionToTagName(versionMax));
  }

  const versions: string[] = [];

  for (const release of allReleases) {
    const version = tagNameToVersion(release.tagName);

    if (versionMin) {
      if (Bun.semver.order(version, versionMin) === -1) {
        continue;
      }
    }

    if (versionMax) {
      if (Bun.semver.order(version, versionMax) === 1) {
        continue;
      }
    }

    versions.push(release.tagName);
  }

  await installBunVersions({ versions, installDir, target, onInstall });
}
