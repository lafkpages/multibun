import { join } from "node:path";

const bunInstallDir =
  process.env.BUN_INSTALL || join(process.execPath, "..", "..");

export const multibunDir = join(bunInstallDir, "multibun");
export const multibunCacheDir = join(multibunDir, "cache");
export const multibunInstallDir = join(multibunDir, "versions");
