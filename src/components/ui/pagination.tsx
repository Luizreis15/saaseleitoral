import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  query = {},
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function href(nextPage: number, nextSize = pageSize) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextSize));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {total === 0 ? "Nenhum registro" : `Mostrando ${start}–${end} de ${total}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="hidden gap-1 sm:flex">
          {PAGE_SIZE_OPTIONS.map((size) => (
            <Button key={size} asChild size="sm" variant={size === pageSize ? "default" : "outline"}>
              <Link href={href(1, size)}>{size}</Link>
            </Button>
          ))}
        </div>
        <Button asChild size="sm" variant="outline" disabled={page <= 1}>
          <Link href={href(Math.max(1, page - 1))} aria-disabled={page <= 1}>
            Anterior
          </Link>
        </Button>
        <span className="px-2 text-sm tabular-nums text-muted-foreground">
          {page}/{pages}
        </span>
        <Button asChild size="sm" variant="outline" disabled={page >= pages}>
          <Link href={href(Math.min(pages, page + 1))} aria-disabled={page >= pages}>
            Próxima
          </Link>
        </Button>
      </div>
    </div>
  );
}
