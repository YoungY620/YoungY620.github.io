import assert from "node:assert/strict";
import { test } from "node:test";
import { filterSites, normalizeRepo, normalizeRepos, siteUrl } from "./sites.ts";
import type { GithubRepo } from "./sites.ts";

const repo = (overrides: Partial<GithubRepo> = {}): GithubRepo => ({
  name: "riverlight",
  description: "Pixel poker",
  has_pages: true,
  updated_at: "2026-10-19T08:00:00Z",
  language: "TypeScript",
  html_url: "https://github.com/YoungY620/riverlight",
  ...overrides,
});

test("builds root and project Pages URLs", () => {
  assert.equal(siteUrl("YoungY620.github.io"), "https://youngy620.github.io/");
  assert.equal(siteUrl("riverlight"), "https://youngy620.github.io/riverlight/");
});

test("normalizes enabled sites and excludes repositories without Pages", () => {
  assert.equal(normalizeRepo(repo({ has_pages: false })), null);
  const sites = normalizeRepos([
    repo({ updated_at: "2026-10-18T08:00:00Z" }),
    repo({ name: "other", description: null, updated_at: "2026-10-19T08:00:00Z" }),
  ]);
  assert.equal(sites.length, 2);
  assert.equal(sites[0]?.name, "other");
  assert.equal(sites[0]?.description, "暂未填写网站简介");
});

test("filters by name, description, and language", () => {
  const sites = normalizeRepos([repo(), repo({ name: "docs", description: "Course book" })]);
  assert.equal(filterSites(sites, "poker").length, 1);
  assert.equal(filterSites(sites, "typescript").length, 2);
  assert.equal(filterSites(sites, "missing").length, 0);
});
