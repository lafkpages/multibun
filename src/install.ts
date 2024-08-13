import type { BunTarget } from "./target";

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
  access,
  chmod,
  constants,
  mkdir,
  readlink,
  rename,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

import { glob } from "fast-glob";

import { log } from ".";
import { bunExec, multibunCacheDir, multibunInstallDir } from "./config";
import {
  bunReleasesRepoName,
  bunReleasesRepoOwner,
  getAllReleases,
  tagNameToVersion,
  versionToTagName,
} from "./github";
import { compareSemver } from "./semver";
import { detectTarget } from "./target";
import { childProcessFinished, streamToString } from "./utils";

export async function isBunVersionValid(tagName: string) {
  return (await getAllReleases()).some(
    (release) => release.tagName === tagName,
  );
}

export async function validateBunVersion(tagName: string) {
  if (!(await isBunVersionValid(tagName))) {
    throw new Error(`Invalid Bun version: ${tagName}`);
  }
}

interface InstallBunVersionCommonOptions {
  target?: BunTarget;
}

export interface InstallBunVersionOptions
  extends InstallBunVersionCommonOptions {
  version: string;
}

export async function installBunVersion({
  version,
  target,
}: InstallBunVersionOptions) {
  validateBunVersion(version);

  if (!target) {
    target = await detectTarget();
  }
  const targetDownloadFile = join(multibunCacheDir, `${version}-${target}.zip`);

  let exeName = "bun";
  if (target.endsWith("-profile")) {
    exeName = "bun-profile";
  }

  const binDir = join(multibunInstallDir, version, "bin");
  const exe = join(binDir, "bun");

  if (
    await access(exe, constants.R_OK | constants.X_OK)
      .then(() => true)
      .catch(() => false)
  ) {
    log.debug("Already installed:", version);
    return;
  }

  await mkdir(binDir, { recursive: true });

  if (await access(targetDownloadFile, constants.R_OK).catch(() => false)) {
    log.debug("Using cached:", version);
  } else {
    log.debug("Downloading:", version);

    const resp = await fetch(
      `https://github.com/${encodeURIComponent(
        bunReleasesRepoOwner,
      )}/${encodeURIComponent(
        bunReleasesRepoName,
      )}/releases/download/${encodeURIComponent(
        version,
      )}/bun-${encodeURIComponent(target)}.zip`,
    );

    if (!resp.ok || !resp.body) {
      throw new Error(
        `Failed to download ${version} for ${target}: ${resp.statusText}`,
      );
    }

    // await writeFile(targetDownloadFile, new DataView(await resp.arrayBuffer()));
    const writeStream = createWriteStream(targetDownloadFile);
    await finished(Readable.fromWeb(resp.body).pipe(writeStream));
  }

  log.debug("Unzipping:", targetDownloadFile, "to", binDir);

  const unzipProcess = spawn("unzip", ["-oqd", binDir, targetDownloadFile], {
    stdio: ["ignore", "ignore", "pipe"],
  });

  const unzipExitCode = await childProcessFinished(unzipProcess);

  if (unzipExitCode !== 0) {
    throw new Error(
      `Failed to unzip ${version} for ${target}: exit code ${
        unzipProcess.exitCode
      }\n${await streamToString(unzipProcess.stderr)}`,
    );
  }

  const unzippedDir = join(binDir, `bun-${target}`);

  await rename(join(unzippedDir, exeName), exe);

  await chmod(exe, 0o755);

  await rm(unzippedDir, { recursive: true });
}

interface InstallBunVersionsCommonOptions
  extends InstallBunVersionCommonOptions {
  onInstall?: (version: string) => void;
  onError?: (err: unknown) => void;
}

export interface InstallBunVersionsOptions
  extends InstallBunVersionsCommonOptions {
  versions: string[];
}

export async function installBunVersions({
  versions,
  target,
  onInstall,
  onError,
}: InstallBunVersionsOptions) {
  for (const version of versions) {
    const promise = installBunVersion({
      version,
      target,
    }).then(() => {
      onInstall?.(version);
    });

    if (onError) {
      try {
        await promise;
      } catch (err) {
        onError(err);
      }
    } else {
      await promise;
    }
  }
}

export interface InstallBunVersionsInRangeOptions
  extends InstallBunVersionsCommonOptions {
  versionMin?: string;
  versionMax?: string;
}

export async function installBunVersionsInRange({
  versionMin,
  versionMax,
  target,
  onInstall,
  onError,
}: InstallBunVersionsInRangeOptions) {
  if (versionMin) {
    validateBunVersion(versionToTagName(versionMin));
  }
  if (versionMax) {
    validateBunVersion(versionToTagName(versionMax));
  }

  const versions: string[] = [];

  for (const release of await getAllReleases()) {
    const version = tagNameToVersion(release.tagName);

    if (versionMin) {
      if (compareSemver(version, versionMin) === -1) {
        continue;
      }
    }

    if (versionMax) {
      if (compareSemver(version, versionMax) === 1) {
        continue;
      }
    }

    versions.push(release.tagName);
  }

  await installBunVersions({
    versions,
    target,
    onInstall,
    onError,
  });
}

export async function getInstalledVersions(sort: boolean | null = true) {
  // TODO: use readdir with RegEx instead of glob
  const versions = (
    await glob("bun-v?*/bin/bun", {
      cwd: multibunInstallDir,
    })
  ).map(
    (bunInstallation) =>
      [
        bunInstallation,
        bunInstallation.match(/^bun-v(.+)\/bin\/bun$/)![1],
      ] as const,
  );

  if (sort === null) {
    return versions;
  } else {
    return versions.sort(
      ([, versionA], [, versionB]) =>
        compareSemver(versionA, versionB) * (sort ? 1 : -1),
    );
  }
}

export async function getCurrentVersion(errorOnNotSymlink = true) {
  const link = await readlink(bunExec).catch(() => null);

  if (!link) {
    if (errorOnNotSymlink) {
      throw new Error("Global bun executable is not a symlink");
    }
    return null;
  }

  if (!link.startsWith(multibunInstallDir)) {
    throw new Error("Global bun executable is not managed by multibun");
  }

  const version = link?.match(/(bun-v(.+))\/bin\/bun$/);

  if (!version) {
    throw new Error("Global bun executable path is invalid");
  }

  return {
    tagName: version[1],
    version: version[2],
  };
}
