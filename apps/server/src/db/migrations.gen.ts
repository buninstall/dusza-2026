import migration0 from "../../drizzle/0000_init.sql" with { type: "text" };

export type Migration = { readonly name: string; readonly sql: string };

export const migrations: readonly Migration[] = [{ name: "0000_init", sql: migration0 }];
