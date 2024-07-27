import { installBunVersionsInRange } from "./install";

await installBunVersionsInRange({
  versionMin: "0.5.0",
  installDir: (version) => `.cache/${version}`,
});
