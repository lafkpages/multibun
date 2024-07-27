import { Octokit } from "octokit";

if (!process.env.GITHUB_API_TOKEN) {
  throw new Error("$GITHUB_TOKEN is required");
}

const octokit = new Octokit({
  auth: process.env.GITHUB_API_TOKEN,
});

const allReleasesCache = Bun.file(".cache/all-releases.json");

interface QueryData {
  repository: {
    releases: {
      nodes: { tagName: string }[];
    };
  };
}

export async function getAllReleases(
  useCache = true
): Promise<QueryData["repository"]["releases"]["nodes"]> {
  if (useCache) {
    const allReleasesCacheAge = Date.now() - allReleasesCache.lastModified;

    // only use cache if it's less than a day old
    if (allReleasesCacheAge < 86400000) {
      try {
        return await allReleasesCache.json();
      } catch {}
    }
  }

  const releases = await octokit.graphql.paginate<QueryData>(`
    query allReleases($cursor: String) {
      repository(owner: "jarred-sumner", name: "bun-releases-for-updater") {
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
  `);
  const releasesNodes = releases?.repository?.releases?.nodes;

  if (!releasesNodes?.length) {
    console.dir(releases, { depth: null });
    throw new Error("Failed to fetch all Bun releases from GitHub");
  }

  await Bun.write(allReleasesCache, JSON.stringify(releasesNodes));

  return releasesNodes;
}

export function tagNameToVersion(tagName: string) {
  if (tagName.startsWith("bun-v")) {
    return tagName.slice(5);
  }
  throw new Error(`Invalid Bun release tag name: ${tagName}`);
}
