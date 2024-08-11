import { join } from "node:path";

const bunInstallationDir =
  process.env.BUN_INSTALL || join(process.execPath, "..", "..");
export const bunBinDir = join(bunInstallationDir, "bin");

export const multibunDir = join(bunInstallationDir, "multibun");

export const multibunCacheDir = join(multibunDir, "cache");
export const multibunInstallDir = join(multibunDir, "versions");
