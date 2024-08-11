import { join } from "node:path";

import { multibunCacheDir } from "./config";

if (!process.env.GITHUB_API_TOKEN) {
  throw new Error("$GITHUB_TOKEN is required");
}

const githubApi =
  process.env.GITHUB_GRAPHQL_ENDPOINT || "https://api.github.com/graphql";

const allReleasesCache = Bun.file(join(multibunCacheDir, "all-releases.json"));

export const bunReleasesRepoOwner = "jarred-sumner";
export const bunReleasesRepoName = "bun-releases-for-updater";

interface QueryData {
  repository: {
    releases: {
      nodes: { tagName: string }[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
}

export async function getAllReleases(useCache = true) {
  if (useCache) {
    const allReleasesCacheAge = Date.now() - allReleasesCache.lastModified;

    // only use cache if it's less than a day old
    if (allReleasesCacheAge < 86400000) {
      try {
        return await allReleasesCache.json();
      } catch {}
    }
  }

  const releases: QueryData["repository"]["releases"]["nodes"] = [];

  let cursor: string | null = null;
  while (true) {
    const resp: QueryData = await fetch(githubApi, {
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
    }).then((r) => r.json());

    releases.push(...resp.repository.releases.nodes);

    if (!resp.repository.releases.pageInfo.hasNextPage) {
      break;
    }

    cursor = resp.repository.releases.pageInfo.endCursor;
  }

  if (!releases.length) {
    throw new Error("Failed to fetch all Bun releases from GitHub");
  }

  await Bun.write(allReleasesCache, JSON.stringify(releases));

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
