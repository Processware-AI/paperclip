#!/usr/bin/env node
/**
 * pc-api.js — UTF-8 safe Paperclip API helper
 *
 * Use this instead of curl for POST/PATCH/PUT requests that contain
 * non-ASCII text (Korean, Japanese, Chinese, etc.). curl on Windows
 * can corrupt UTF-8 characters in request bodies.
 *
 * Usage:
 *   node skills/paperclip/pc-api.js <METHOD> <PATH> [JSON_BODY]
 *
 * Examples:
 *   node skills/paperclip/pc-api.js GET /api/agents/me
 *   node skills/paperclip/pc-api.js PATCH /api/issues/abc123 '{"status":"done","comment":"작업 완료"}'
 *   node skills/paperclip/pc-api.js POST /api/issues/abc123/comments '{"body":"한글 댓글"}'
 *
 * Env vars used (auto-injected in heartbeat):
 *   PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_RUN_ID
 */

import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { URL } from "node:url";

const method = (process.argv[2] ?? "GET").toUpperCase();
const apiPath = process.argv[3];
const bodyArg = process.argv[4];

if (!apiPath) {
  console.error("Usage: node pc-api.js <METHOD> <PATH> [JSON_BODY]");
  process.exit(1);
}

const apiUrl = process.env.PAPERCLIP_API_URL;
const apiKey = process.env.PAPERCLIP_API_KEY;
const runId = process.env.PAPERCLIP_RUN_ID;

if (!apiUrl) {
  console.error("Error: PAPERCLIP_API_URL is not set");
  process.exit(1);
}
if (!apiKey) {
  console.error("Error: PAPERCLIP_API_KEY is not set");
  process.exit(1);
}

const fullUrl = new URL(apiPath, apiUrl);
const isHttps = fullUrl.protocol === "https:";

const headers = {
  "Authorization": `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};
if (runId) {
  headers["X-Paperclip-Run-Id"] = runId;
}

const bodyStr = bodyArg ? bodyArg : null;
// Encode as UTF-8 Buffer to preserve non-ASCII characters
const bodyBuffer = bodyStr ? Buffer.from(bodyStr, "utf8") : null;

if (bodyBuffer) {
  headers["Content-Length"] = bodyBuffer.byteLength;
}

const options = {
  hostname: fullUrl.hostname,
  port: fullUrl.port || (isHttps ? 443 : 80),
  path: fullUrl.pathname + fullUrl.search,
  method,
  headers,
};

const req = (isHttps ? httpsRequest : httpRequest)(options, (res) => {
  const chunks = [];
  res.setEncoding("utf8");
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => {
    const body = chunks.join("");
    process.stdout.write(body);
    if (res.statusCode && res.statusCode >= 400) {
      process.exit(1);
    }
  });
});

req.on("error", (err) => {
  console.error("Request error:", err.message);
  process.exit(1);
});

if (bodyBuffer) {
  req.write(bodyBuffer);
}
req.end();
