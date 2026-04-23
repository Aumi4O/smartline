import { redis } from "@/lib/redis";
import { NextResponse } from "next/server";

interface RateLimitConfig {
  maxRequests: number;
  windowSec: number;
}

const DEFAULTS: Record<string, RateLimitConfig> = {
  api: { maxRequests: 60, windowSec: 60 },
  auth: { maxRequests: 10, windowSec: 60 },
  billing: { maxRequests: 5, windowSec: 60 },
  webhook: { maxRequests: 100, windowSec: 60 },
};

export async function rateLimit(
  identifier: string,
  type: keyof typeof DEFAULTS = "api"
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const config = DEFAULTS[type] || DEFAULTS.api;
  const key = `rl:${type}:${identifier}`;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, config.windowSec);
    }

    const ttl = await redis.ttl(key);

    return {
      success: current <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - current),
      reset: ttl > 0 ? ttl : config.windowSec,
    };
  } catch {
    return { success: true, remaining: config.maxRequests, reset: config.windowSec };
  }
}

export function rateLimitResponse(reset: number) {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(reset),
        "X-RateLimit-Reset": String(reset),
      },
    }
  );
}
