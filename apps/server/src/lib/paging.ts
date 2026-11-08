export type PageRequest = { page: number; pageSize: number };

export type PageMeta = { page: number; pageSize: number; total: number; pageCount: number };

export function pageMeta(request: PageRequest, total: number): PageMeta {
  const pageCount = Math.max(1, Math.ceil(total / request.pageSize));
  return {
    page: Math.min(Math.max(1, request.page), pageCount),
    pageSize: request.pageSize,
    total,
    pageCount,
  };
}

export function offsetOf(meta: PageMeta): number {
  return (meta.page - 1) * meta.pageSize;
}

const LIKE_SPECIAL = /[\\%_]/g;

export function containsPattern(text: string): string {
  return `%${text.replace(LIKE_SPECIAL, (char) => `\\${char}`)}%`;
}
