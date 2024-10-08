import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const bunInstallationDir = process.env.BUN_INSTALL;

if (!bunInstallationDir) {
  throw new Error("$BUN_INSTALL environment variable is not set");
}

export const bunBinDir = join(bunInstallationDir, "bin");
export const bunExec = join(bunBinDir, "bun");

export const multibunDir =
  process.env.MULTIBUN_DIR || join(bunInstallationDir, "multibun");

export const multibunCacheDir = join(multibunDir, "cache");
export const multibunInstallDir = join(multibunDir, "versions");

await mkdir(multibunCacheDir, { recursive: true });
await mkdir(multibunInstallDir, { recursive: true });

export const githubToken =
  process.env.MULTIBUN_GITHUB_TOKEN ||
  process.env.GITHUB_TOKEN ||
  process.env.GITHUB_API_TOKEN;
export const githubApi =
  process.env.MULTIBUN_GITHUB_GRAPHQL_ENDPOINT ||
  process.env.GITHUB_GRAPHQL_ENDPOINT ||
  "https://api.github.com/graphql";
