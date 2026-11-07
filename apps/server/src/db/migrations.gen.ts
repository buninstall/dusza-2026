import migration0 from "../../drizzle/0000_init.sql" with { type: "text" };
import migration1 from "../../drizzle/0001_game_features.sql" with { type: "text" };
import migration2 from "../../drizzle/0002_lamp_mode.sql" with { type: "text" };
import migration3 from "../../drizzle/0003_scale.sql" with { type: "text" };

export type Migration = { readonly name: string; readonly sql: string };

export const migrations: readonly Migration[] = [
  { name: "0000_init", sql: migration0 },
  { name: "0001_game_features", sql: migration1 },
  { name: "0002_lamp_mode", sql: migration2 },
  { name: "0003_scale", sql: migration3 },
];
