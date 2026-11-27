import { createHash } from "node:crypto";

const buckets = new Map();
let requestsSinceCleanup = 0;

const redisScript = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if ARGV[1] == 'increment' then
  current = redis.call('INCR', KEYS[1])
  if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then ttl = tonumber(ARGV[2]) end
return { current, ttl }
`;

async function sharedBucket(key, windowMs, increment) {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Shared rate limiting requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
    }
    return null;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", redisScript, "1", `whizzkids:rate:${key}`, increment ? "increment" : "read", String(windowMs)]),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Shared rate-limit store returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload.error || !Array.isArray(payload.result)) throw new Error("Shared rate-limit store returned an invalid response.");
  return { count: Number(payload.result[0]), retryAfter: Math.max(1, Math.ceil(Number(payload.result[1]) / 1000)) };
}

export class RequestBodyError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function readJson(request, maxBytes) {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("content-type") || "")) {
    throw new RequestBodyError(415, "Content-Type must be application/json.");
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new RequestBodyError(413, "Request body is too large.");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError(400, "A JSON request body is required.");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyError(413, "Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new RequestBodyError(400, "Request body must be a JSON object.");
    }
    return value;
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400, "Request body must contain valid JSON.");
  }
}

function requestAddress(request) {
  // Production deployments must use a trusted reverse proxy that overwrites
  // these headers. Directly exposed multi-instance deployments need a shared
  // rate-limit store instead of this process-local fallback.
  return (request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "unknown")
    .split(",")[0].trim().slice(0, 100);
}

function rateLimitKey(request, scope, subject) {
  return createHash("sha256")
    .update(`${scope}\0${requestAddress(request)}\0${String(subject).toLowerCase()}`)
    .digest("hex");
}

function getBucket(key, windowMs, now) {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  return bucket;
}

export async function rateLimitStatus(request, scope, subject, limit, windowMs) {
  const digest = rateLimitKey(request, scope, subject);
  const shared = await sharedBucket(digest, windowMs, false);
  if (shared) return { allowed: shared.count < limit, retryAfter: shared.retryAfter };
  const now = Date.now();
  const bucket = getBucket(digest, windowMs, now);
  return {
    allowed: bucket.count < limit,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export async function checkRateLimit(request, scope, subject, limit, windowMs) {
  const digest = rateLimitKey(request, scope, subject);
  const shared = await sharedBucket(digest, windowMs, true);
  if (shared) return { allowed: shared.count <= limit, retryAfter: shared.retryAfter };
  const now = Date.now();
  const bucket = getBucket(digest, windowMs, now);
  bucket.count += 1;

  requestsSinceCleanup += 1;
  if (requestsSinceCleanup >= 256) {
    requestsSinceCleanup = 0;
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(key);
    }
  }

  return {
    allowed: bucket.count <= limit,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}
