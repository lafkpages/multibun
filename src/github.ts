import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { githubApi, githubToken, multibunCacheDir } from "./config";

const allReleasesCache = join(multibunCacheDir, "all-releases.json");

export const bunReleasesRepoOwner = "jarred-sumner";
export const bunReleasesRepoName = "bun-releases-for-updater";

interface QueryData {
  data: {
    repository: {
      releases: {
        nodes: { tagName: string }[];
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
      };
    };
  };
}

export async function getAllReleases(
  useCache = true,
): Promise<QueryData["data"]["repository"]["releases"]["nodes"]> {
  if (useCache) {
    const allReleasesCacheStat = await stat(allReleasesCache).catch(() => null);
    const allReleasesCacheAge = allReleasesCacheStat
      ? Date.now() - allReleasesCacheStat.mtimeMs
      : Infinity;

    // only use cache if it's less than a day old
    if (allReleasesCacheAge < 86400000) {
      try {
        return JSON.parse(await readFile(allReleasesCache, "utf-8"));
      } catch {}
    }
  }

  const releases: QueryData["data"]["repository"]["releases"]["nodes"] = [];

  let cursor: string | null = null;
  const headers = new Headers();
  if (githubToken) {
    headers.set("Authorization", `Bearer ${githubToken}`);
  }
  while (true) {
    const resp: Response = await fetch(githubApi, {
      method: "POST",
      body: JSON.stringify({
        query: `
          query allReleases($owner: String!, $name: String!, $cursor: String) {
            repository(owner: $owner, name: $name) {
              releases(first: 100, after: $cursor) {
                nodes {
                  tagName
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        `,
        variables: {
          owner: bunReleasesRepoOwner,
          name: bunReleasesRepoName,
          cursor,
        },
      }),
      headers,
    });
    const data: QueryData | { message: string } = await resp.json();

    if (!resp.ok || !("data" in data)) {
      const message = "message" in data ? data.message : resp.statusText;
      throw new Error(`Failed to fetch Bun releases from GitHub: ${message}`);
    }

    releases.push(...data.data.repository.releases.nodes);

    if (!data.data.repository.releases.pageInfo.hasNextPage) {
      break;
    }

    cursor = data.data.repository.releases.pageInfo.endCursor;
  }

  if (!releases.length) {
    throw new Error("Failed to fetch all Bun releases from GitHub");
  }

  await writeFile(allReleasesCache, JSON.stringify(releases));

  return releases;
}

export function tagNameToVersion(tagName: string) {
  if (tagName.startsWith("bun-v")) {
    return tagName.slice(5);
  }
  throw new Error(`Invalid Bun release tag name: ${tagName}`);
}

export function versionToTagName(version: string, allowTagName = false) {
  if (version.startsWith("bun-v")) {
    if (allowTagName) {
      return version;
    }
    throw new Error(`Received unexpected tag name: ${version}`);
  }

  return `bun-v${version}`;
}

export async function resolveVersion(version: string) {
  if (version === "latest") {
    return (await getAllReleases())[0].tagName;
  }

  return versionToTagName(version, true);
}
