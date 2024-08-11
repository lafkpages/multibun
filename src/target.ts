import { exec } from "node:child_process";
import { arch, platform } from "node:os";
import { promisify } from "node:util";

export const bunTargetsNormal = [
  "darwin-aarch64",
  "darwin-x64",
  "darwin-x64-baseline",
  "linux-aarch64",
  "linux-x64",
  "linux-x64-baseline",
  "windows-x64",
  "windows-x64-baseline",
] as const;
export type BunTargetNormal = (typeof bunTargetsNormal)[number];

export const bunTargetsProfile = [
  "darwin-aarch64-profile",
  "darwin-x64-profile",
  "darwin-x64-baseline-profile",
  "linux-aarch64-profile",
  "linux-x64-profile",
  "linux-x64-baseline-profile",
  "windows-x64-profile",
  "windows-x64-baseline-profile",
] as const satisfies `${BunTargetNormal}-profile`[];
export type BunTargetProfile = (typeof bunTargetsProfile)[number];

export const bunTargets = [...bunTargetsNormal, ...bunTargetsProfile] as const;
export type BunTarget = (typeof bunTargets)[number];

export async function detectTarget() {
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
      (
        await promisify(exec)("sysctl -n sysctl.proc_translated")
      ).stdout.trim() === "1";

    if (isRosetta) {
      target = "darwin-aarch64";
    }
  }

  return target;
}
