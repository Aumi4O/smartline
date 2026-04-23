/**
 * In-memory Redis mock covering the subset of commands used by the codebase.
 * Currently: incr, expire, ttl, get, set, del.
 */

interface Entry {
  value: string | number;
  expiresAt: number | null;
}

const store = new Map<string, Entry>();

export function resetMockRedis() {
  store.clear();
}

function getActive(key: string): Entry | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (e.expiresAt !== null && Date.now() >= e.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return e;
}

export const mockRedis = {
  async incr(key: string): Promise<number> {
    const e = getActive(key);
    const current = e ? Number(e.value) + 1 : 1;
    store.set(key, {
      value: current,
      expiresAt: e?.expiresAt ?? null,
    });
    return current;
  },
  async expire(key: string, seconds: number): Promise<number> {
    const e = getActive(key);
    if (!e) return 0;
    e.expiresAt = Date.now() + seconds * 1000;
    store.set(key, e);
    return 1;
  },
  async ttl(key: string): Promise<number> {
    const e = getActive(key);
    if (!e || e.expiresAt === null) return e ? -1 : -2;
    return Math.max(0, Math.ceil((e.expiresAt - Date.now()) / 1000));
  },
  async get(key: string): Promise<string | null> {
    const e = getActive(key);
    return e ? String(e.value) : null;
  },
  async set(key: string, value: string | number, opts?: { ex?: number }): Promise<string> {
    const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : null;
    store.set(key, { value, expiresAt });
    return "OK";
  },
  async del(key: string): Promise<number> {
    return store.delete(key) ? 1 : 0;
  },
};

export function redisMockFactory() {
  return { redis: mockRedis };
}
