export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export function parsePage(value?: string | null): number {
  const n = Number(value ?? 1);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

export function parsePageSize(value?: string | null): number {
  const n = Number(value ?? DEFAULT_PAGE_SIZE);
  if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return n;
  return DEFAULT_PAGE_SIZE;
}

export function rangeForPage(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

export function totalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}
