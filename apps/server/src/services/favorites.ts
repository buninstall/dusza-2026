import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { mapFavorites, maps } from "../db/schema.ts";

export type FavoriteState = { isFavorite: boolean; favoriteCount: number };

export function setFavorite(
  db: Db,
  input: { userId: number; mapId: number; isFavorite: boolean; now: number },
): Promise<FavoriteState> {
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: maps.id })
      .from(maps)
      .where(eq(maps.id, input.mapId))
      .for("update");
    if (!locked) {
      return { isFavorite: false, favoriteCount: 0 };
    }
    if (input.isFavorite) {
      const [inserted] = await tx
        .insert(mapFavorites)
        .ignore()
        .values({ userId: input.userId, mapId: input.mapId, createdAt: input.now });
      if (inserted.affectedRows > 0) {
        await tx
          .update(maps)
          .set({ favoriteCount: sql`${maps.favoriteCount} + 1` })
          .where(eq(maps.id, input.mapId));
      }
    } else {
      const [removed] = await tx
        .delete(mapFavorites)
        .where(and(eq(mapFavorites.userId, input.userId), eq(mapFavorites.mapId, input.mapId)));
      if (removed.affectedRows > 0) {
        await tx
          .update(maps)
          .set({ favoriteCount: sql`greatest(${maps.favoriteCount} - 1, 0)` })
          .where(eq(maps.id, input.mapId));
      }
    }
    const [row] = await tx
      .select({ value: maps.favoriteCount })
      .from(maps)
      .where(eq(maps.id, input.mapId));
    return { isFavorite: input.isFavorite, favoriteCount: row?.value ?? 0 };
  });
}
