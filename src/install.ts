import { join } from "node:path";
import { mkdir, rename, chmod, rm, readlink } from "node:fs/promises";
import {
  bunReleasesRepoName,
  bunReleasesRepoOwner,
  getAllReleases,
  tagNameToVersion,
  versionToTagName,
} from "./github";
import { detectTarget, type BunTarget } from "./target";
import { log } from ".";
import { bunExec, multibunCacheDir, multibunInstallDir } from "./config";

const allReleases = await getAllReleases();

export function isBunVersionValid(tagName: string) {
  return allReleases.some((release) => release.tagName === tagName);
}

export function validateBunVersion(tagName: string) {
  if (!isBunVersionValid(tagName)) {
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
    target = detectTarget();
  }
  const targetDownloadFile = Bun.file(
    join(multibunCacheDir, `${version}-${target}.zip`)
  );

  let exeName = "bun";
  if (target.endsWith("-profile")) {
    exeName = "bun-profile";
  }

  const binDir = join(multibunInstallDir, version, "bin");
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
      `https://github.com/${encodeURIComponent(
        bunReleasesRepoOwner
      )}/${encodeURIComponent(
        bunReleasesRepoName
      )}/releases/download/${encodeURIComponent(
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

  await installBunVersions({
    versions,
    target,
    onInstall,
    onError,
  });
}

export async function getInstalledVersions(sort: boolean | null = true) {
  const versions = (
    await Array.fromAsync(
      new Bun.Glob("bun-v?*/bin/bun").scan({
        cwd: multibunInstallDir,
        onlyFiles: false,
      })
    )
  ).map(
    (bunInstallation) =>
      [
        bunInstallation,
        bunInstallation.match(/^bun-v(.+)\/bin\/bun$/)![1],
      ] as const
  );

  if (sort === null) {
    return versions;
  } else {
    return versions.sort(
      ([, versionA], [, versionB]) =>
        Bun.semver.order(versionA, versionB) * (sort ? 1 : -1)
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
