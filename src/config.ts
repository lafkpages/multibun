import { join } from "node:path";

const bunInstallationDir = process.env.BUN_INSTALL;

if (!bunInstallationDir) {
  throw new Error("$BUN_INSTALL environment variable is not set");
}

export const bunBinDir = join(bunInstallationDir, "bin");

export const multibunDir =
  process.env.MULTIBUN_DIR || join(bunInstallationDir, "multibun");

export const multibunCacheDir = join(multibunDir, "cache");
export const multibunInstallDir = join(multibunDir, "versions");
