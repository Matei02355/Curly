type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();

export function assertRateLimit(
  key: string,
  options: { limit?: number; windowMs?: number } = {},
) {
  const limit = options.limit ?? 5;
  const windowMs = options.windowMs ?? 10 * 60 * 1000;
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
    throw new Error(`Too many attempts. Try again in ${retryAfterSeconds}s.`);
  }

  current.count += 1;
  store.set(key, current);
}

export function clearRateLimit(key: string) {
  store.delete(key);
}
