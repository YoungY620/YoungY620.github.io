export const GITHUB_OWNER = "YoungY620";
const PAGES_ROOT = "https://youngy620.github.io";

export interface GithubRepo {
  name: string;
  description: string | null;
  has_pages: boolean;
  updated_at: string;
  language: string | null;
  html_url: string;
}

export interface Site {
  name: string;
  description: string;
  url: string;
  sourceUrl: string;
  updatedAt: string;
  language: string;
}

export function siteUrl(name: string) {
  return name === `${GITHUB_OWNER}.github.io` ? `${PAGES_ROOT}/` : `${PAGES_ROOT}/${name}/`;
}

export function normalizeRepo(repo: GithubRepo): Site | null {
  if (!repo.has_pages) return null;
  return {
    name: repo.name,
    description: repo.description?.trim() || "暂未填写网站简介",
    url: siteUrl(repo.name),
    sourceUrl: repo.html_url,
    updatedAt: repo.updated_at,
    language: repo.language ?? "",
  };
}

export function normalizeRepos(repos: GithubRepo[]) {
  return repos
    .map(normalizeRepo)
    .filter((site): site is Site => site !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function filterSites(sites: Site[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return sites;
  return sites.filter((site) => `${site.name} ${site.description} ${site.language}`.toLocaleLowerCase().includes(normalized));
}

export async function fetchSiteDirectory(fetcher = fetch): Promise<Site[]> {
  const response = await fetcher(`https://api.github.com/users/${GITHUB_OWNER}/repos?per_page=100&sort=updated`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  const repos = await response.json() as GithubRepo[];
  if (!Array.isArray(repos)) throw new Error("Unexpected repository response");
  return normalizeRepos(repos);
}
