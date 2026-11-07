import { eq } from "drizzle-orm";
import { hashPassword } from "../auth/password.ts";
import { isDuplicateEntry } from "../db/errors.ts";
import { firstRow } from "../db/rows.ts";
import { type User, users } from "../db/schema.ts";
import type { Deps } from "../env.ts";

export type NewAccount = {
  username: string;
  password: string;
  role: User["role"];
};

export async function createAccount(deps: Deps, account: NewAccount): Promise<User | null> {
  try {
    const { id } = firstRow(
      await deps.db
        .insert(users)
        .values({
          username: account.username,
          passwordHash: await hashPassword(account.password),
          role: account.role,
          createdAt: deps.now(),
        })
        .$returningId(),
    );
    return firstRow(await deps.db.select().from(users).where(eq(users.id, id)));
  } catch (error) {
    if (isDuplicateEntry(error)) {
      return null;
    }
    throw error;
  }
}
