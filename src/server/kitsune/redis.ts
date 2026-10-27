// Redis is not available on this host; caches fall back to in-memory.
export const isRedisConfigured = () => false;
export async function redisGet(_k: string): Promise<string | null> { return null; }
export async function redisSet(_k: string, _v: string, _ttl?: number): Promise<void> {}
export async function redisDel(_k: string): Promise<void> {}
export async function redisKeys(_p: string): Promise<string[]> { return []; }
