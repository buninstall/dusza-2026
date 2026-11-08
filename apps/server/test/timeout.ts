import { setDefaultTimeout } from "bun:test";

export const TEST_TIMEOUT_MS = 20_000;

setDefaultTimeout(TEST_TIMEOUT_MS);
