export const compareSemver = process.isBun
  ? Bun.semver.order
  : (await import("semver/functions/compare")).default;
