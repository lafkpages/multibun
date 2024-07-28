import { join } from "node:path";
import { mkdir, rename, chmod, rm } from "node:fs/promises";
import {
  bunReleasesRepoName,
  bunReleasesRepoOwner,
  getAllReleases,
  tagNameToVersion,
  versionToTagName,
} from "./github";
import { detectTarget, type BunTarget } from "./target";
import { log } from ".";

const allReleases = await getAllReleases();

export function validateBunVersion(tagName: string) {
  if (!allReleases.some((release) => release.tagName === tagName)) {
    throw new Error(`Invalid Bun version: ${tagName}`);
  }
}

interface InstallBunVersionCommonOptions {
  target?: BunTarget;
}

export interface InstallBunVersionOptions
  extends InstallBunVersionCommonOptions {
  version: string;
  installDir: string;
}

export async function installBunVersion({
  version,
  installDir,
  target,
}: InstallBunVersionOptions) {
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
  installDir: (version: string) => string;
  onInstall?: (version: string) => void;
  onError?: (err: unknown) => void;
}

export interface InstallBunVersionsOptions
  extends InstallBunVersionsCommonOptions {
  versions: string[];
}

export async function installBunVersions({
  versions,
  installDir,
  target,
  onInstall,
  onError,
}: InstallBunVersionsOptions) {
  for (const version of versions) {
    const promise = installBunVersion({
      version,
      installDir: installDir(version),
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
  installDir,
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
    installDir,
    target,
    onInstall,
    onError,
  });
}
