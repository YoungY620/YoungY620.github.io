import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteCard } from "@/components/SiteCard";
import { fetchSiteDirectory, filterSites, type Site } from "@/sites";

const CACHE_KEY = "youngy620-sites-v1";
const SYNC_KEY = "youngy620-sites-sync-v1";

function readCache(): Site[] {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

export function App() {
  const [sites, setSites] = useState<Site[]>(readCache);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(() => localStorage.getItem(SYNC_KEY) ?? "");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const next = await fetchSiteDirectory();
      const timestamp = new Date().toISOString();
      setSites(next);
      setLastSync(timestamp);
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      localStorage.setItem(SYNC_KEY, timestamp);
    } catch {
      setError("同步失败，显示最近一次成功结果。请检查网络后重试。");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  const filtered = filterSites(sites, query);
  const syncTime = lastSync ? lastSync.slice(11, 19) : "尚未同步";

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Young E. 的网站</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">项目、游戏与在线教材，定时从 GitHub 更新。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? "正在同步…" : "立即刷新"}
          </Button>
        </div>
      </header>

      <section className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-label="目录筛选与同步状态">
        <div className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {sites.length} 个启用 Pages 的网站 · 每 60 秒自动同步 · 最近同步 {syncTime}
        </div>
        <div className="w-full sm:max-w-xs">
          <label htmlFor="site-search" className="sr-only">按名称或简介筛选</label>
          <Input
            id="site-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="按名称或简介筛选"
            autoComplete="off"
          />
        </div>
      </section>

      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

      <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="网站列表">
        {filtered.map((site) => <SiteCard key={site.name} site={site} />)}
      </section>

      {filtered.length === 0 && (
        <section className="mt-8 rounded-3xl border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-medium">{sites.length === 0 ? "暂未读取到网站" : "没有匹配的网站"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {sites.length === 0 ? "启用 GitHub Pages 后，网站会出现在这里。" : "尝试其他名称或简介关键词。"}
          </p>
          {query && <Button variant="outline" className="mt-4" onClick={() => setQuery("")}>清除筛选</Button>}
        </section>
      )}
    </main>
  );
}
