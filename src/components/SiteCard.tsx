import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { Site } from "@/sites";

export function SiteCard({ site }: { site: Site }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="break-words text-xl">{site.name}</CardTitle>
          {site.language && <Badge variant="info" className="shrink-0">{site.language}</Badge>}
        </div>
        <CardDescription className="leading-relaxed">{site.description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto text-sm text-muted-foreground">
        更新于 <time dateTime={site.updatedAt}>{site.updatedAt.slice(0, 10)}</time>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href={site.url} target="_blank" rel="noreferrer">打开网站</a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={site.sourceUrl} target="_blank" rel="noreferrer">查看源码</a>
        </Button>
      </CardFooter>
    </Card>
  );
}
