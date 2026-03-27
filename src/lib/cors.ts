import { NextResponse } from "next/server";
import { env } from "./env";

function getAllowedOrigins() {
  return env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
}

export function getCorsHeaders(requestOrigin?: string | null) {
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function withCors(response: NextResponse, requestOrigin?: string | null) {
  const headers = getCorsHeaders(requestOrigin);

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export function buildOptionsResponse(requestOrigin?: string | null) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(requestOrigin),
  });
}
