import { and, asc, count, desc, eq, like, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { firstRow } from "../db/rows.ts";
import { type ProgramRow, programs, users } from "../db/schema.ts";
import {
  containsPattern,
  offsetOf,
  type PageMeta,
  type PageRequest,
  pageMeta,
} from "../lib/paging.ts";

export const PROGRAM_LIMIT = 500;

export type ProgramSort = "recent" | "title";

export type ProgramListQuery = PageRequest & { q: string; sort: ProgramSort };

export type ProgramListItem = { id: number; title: string; updatedAt: number; lines: number };

export type ProgramPage = PageMeta & {
  programs: ProgramListItem[];
  quota: { used: number; limit: number };
};

const NEWLINE = "\n";

function lineCount(): SQL<number> {
  const source = programs.source;
  return sql<number>`case when char_length(${source}) = 0 then 0 else
    char_length(${source}) - char_length(replace(${source}, ${NEWLINE}, '')) +
    (right(${source}, 1) <> ${NEWLINE}) end`;
}

function orderOf(query: ProgramListQuery): SQL[] {
  const base =
    query.sort === "title"
      ? [asc(programs.title), asc(programs.id)]
      : [desc(programs.updatedAt), desc(programs.id)];
  if (query.q.length === 0) {
    return base;
  }
  const titleHit = sql`case when ${like(programs.title, containsPattern(query.q))} then 0 else 1 end`;
  return [asc(titleHit), ...base];
}

async function countOwned(db: Db, ownerId: number, filter?: SQL): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(programs)
    .where(and(eq(programs.ownerId, ownerId), filter));
  return row?.value ?? 0;
}

export async function listProgramPage(
  db: Db,
  ownerId: number,
  query: ProgramListQuery,
): Promise<ProgramPage> {
  const pattern = query.q.length > 0 ? containsPattern(query.q) : null;
  const filter = pattern
    ? or(like(programs.title, pattern), like(programs.source, pattern))
    : undefined;
  const used = await countOwned(db, ownerId);
  const total = filter ? await countOwned(db, ownerId, filter) : used;
  const meta = pageMeta(query, total);
  const list =
    total === 0
      ? []
      : await db
          .select({
            id: programs.id,
            title: programs.title,
            updatedAt: programs.updatedAt,
            lines: lineCount(),
          })
          .from(programs)
          .where(and(eq(programs.ownerId, ownerId), filter))
          .orderBy(...orderOf(query))
          .limit(meta.pageSize)
          .offset(offsetOf(meta));
  return {
    ...meta,
    programs: list.map((item) => ({ ...item, lines: Number(item.lines) })),
    quota: { used, limit: PROGRAM_LIMIT },
  };
}

export function createProgram(
  db: Db,
  input: { ownerId: number; title: string; source: string; now: number },
): Promise<ProgramRow | null> {
  return db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, input.ownerId)).for("update");
    const [owned] = await tx
      .select({ value: count() })
      .from(programs)
      .where(eq(programs.ownerId, input.ownerId));
    if ((owned?.value ?? 0) >= PROGRAM_LIMIT) {
      return null;
    }
    const { id } = firstRow(
      await tx
        .insert(programs)
        .values({
          ownerId: input.ownerId,
          title: input.title,
          source: input.source,
          updatedAt: input.now,
        })
        .$returningId(),
    );
    return firstRow(await tx.select().from(programs).where(eq(programs.id, id)));
  });
}
