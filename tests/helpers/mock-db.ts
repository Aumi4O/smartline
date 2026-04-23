import { vi } from "vitest";
import { getTestDb } from "./test-db";

/**
 * Replaces the real postgres-js-backed db from @/lib/db with a pglite
 * instance so integration tests don't need a live DB server.
 *
 * Must be called at the top of each test file before importing the
 * module under test.
 */
export function mockDatabase() {
  vi.mock("@/lib/db", async () => {
    const testDb = await getTestDb();
    return { db: testDb };
  });
}
