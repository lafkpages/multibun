import { platform, arch } from "node:os";
import { join } from "node:path";
import { mkdir, rename, chmod, rm } from "node:fs/promises";
import { getAllReleases, tagNameToVersion } from "./github";

export type BunTargetNormal =
  | "darwin-aarch64"
  | "darwin-x64"
  | "darwin-x64-baseline"
  | "linux-aarch64"
  | "linux-x64"
  | "linux-x64-baseline"
  | "windows-x64"
  | "windows-x64-baseline";
export type BunTargetProfile = `${BunTargetNormal}-profile`;
export type BunTarget = BunTargetNormal | BunTargetProfile;

const allReleases = await getAllReleases();

export function validateBunVersion(version: string) {
  if (!allReleases.some((release) => release.tagName === version)) {
    throw new Error(`Invalid Bun version: ${version}`);
  }
}

export function detectTarget() {
  let target: BunTarget;

  switch (`${platform()}-${arch()}`) {
    case "darwin-x64":
      target = "darwin-x64";
      break;

    case "darwin-arm64":
      target = "darwin-aarch64";
      break;

    case "linux-arm64":
      target = "linux-aarch64";
      break;

    case "linux-x64":
      target = "linux-x64";
      break;

    case "win32-x64":
      target = "windows-x64";
      break;

    default:
      throw new Error("Unsupported platform");
  }

  if (target === "darwin-x64") {
    const isRosetta =
      Bun.spawnSync({
        cmd: ["sysctl", "-n", "sysctl.proc_translated"],
        stdin: "ignore",
        stdout: "pipe",
        stderr: "ignore",
      })
        .stdout.toString()
        .trim() === "1";

    if (isRosetta) {
      target = "darwin-aarch64";
    }
  }

  return target;
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
  const targetDownloadFile = Bun.file(`.cache/${version}-${target}.zip`);

  let exeName = "bun";
  if (target.endsWith("-profile")) {
    exeName = "bun-profile";
  }

  const binDir = join(installDir, "bin");
  const exe = join(binDir, "bun");

  await mkdir(binDir, { recursive: true });

  if (!(await targetDownloadFile.exists())) {
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

  await rename(join(unzippedDir, exeName), exe);

  await chmod(exe, 0o755);

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
