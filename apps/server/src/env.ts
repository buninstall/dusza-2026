import type { Engine } from "@minescript/engine";
import type { LoginLimiter } from "./auth/rate-limit.ts";
import type { Db } from "./db/client.ts";
import type { Role } from "./db/schema.ts";
import type { DesktopReleases } from "./services/desktop.ts";

export type SessionUser = {
  id: number;
  username: string;
  role: Role;
  createdAt: number;
};

export type Deps = {
  db: Db;
  engine: Engine;
  limiter: LoginLimiter;
  now: () => number;
  desktop?: DesktopReleases | undefined;
};

export type ConnectionInfo = {
  requestIP?: (request: Request) => { address: string } | null;
};

export type AppEnv = {
  Bindings: ConnectionInfo;
  Variables: { user: SessionUser };
};
