import { createHash } from "node:crypto";

const buckets = new Map();
let requestsSinceCleanup = 0;

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

export function rateLimitStatus(request, scope, subject, limit, windowMs) {
  const now = Date.now();
  const bucket = getBucket(rateLimitKey(request, scope, subject), windowMs, now);
  return {
    allowed: bucket.count < limit,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function checkRateLimit(request, scope, subject, limit, windowMs) {
  const digest = rateLimitKey(request, scope, subject);
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
