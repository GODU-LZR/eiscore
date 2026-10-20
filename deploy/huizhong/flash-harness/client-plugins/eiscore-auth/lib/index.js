import { createBusinessSessionBindings } from '../../../business-session-bindings.mjs';
// client-plugins/eiscore-auth/src/index.ts
import { randomBytes } from "node:crypto";

// client-plugins/http-routes.ts
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
function registerHttpRoute(ctx, route) {
  if (route.method === "GET") {
    ctx.effect(() => ctx.connection.fetch.register({ path: route.path, methods: ["GET"], fetch: route.fetch }));
    return;
  }
  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: route.path,
    handler: async (req, res) => {
      const rejection = ctx.connection.requestRejection(req);
      if (rejection !== void 0) {
        res.writeHead(rejection).end(rejection === 401 ? "unauthorized" : "forbidden");
        return;
      }
      if (req.method !== route.method) {
        res.writeHead(404).end("not found");
        return;
      }
      const abort = new AbortController();
      res.once("close", () => {
        if (!res.writableEnded) abort.abort();
      });
      const limit = route.maxRequestBodyBytes ?? 300 * 1024 * 1024;
      const tooLarge = () => {
        res.writeHead(413, { connection: "close" }).end();
        req.resume();
      };
      if (Number(req.headers["content-length"]) > limit) {
        tooLarge();
        return;
      }
      const chunks = [];
      let received = 0;
      try {
        for await (const chunk of req) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          received += buffer.byteLength;
          if (received > limit) {
            tooLarge();
            return;
          }
          chunks.push(buffer);
        }
        const request = new Request(new URL(req.url || "/", "http://dsh.internal"), {
          method: "POST",
          headers: Object.fromEntries(Object.entries(req.headers).filter((entry) => typeof entry[1] === "string")),
          body: Buffer.concat(chunks),
          signal: abort.signal
        });
        const response = await route.fetch(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body) await pipeline(Readable.from(response.body), res, { signal: abort.signal });
        else res.end();
      } catch {
        if (!res.headersSent && !res.destroyed) res.writeHead(503).end("unavailable");
        else res.destroy();
      }
    }
  }), `eiscore: ${route.path}`);
}

// client-plugins/eiscore-auth/src/index.ts
const businessBindings = createBusinessSessionBindings({ tokenForRequest: sessionToken, claimsForToken: publicClaims });
var SESSION_COOKIE = "eiscore-session";
var AUTH_STATE_COOKIE = "eiscore-auth-state";
var SESSION_TTL_MS = 8 * 60 * 60 * 1e3;
var AUTH_STATE_TTL_MS = 2 * 60 * 1e3;
var MAX_SESSIONS = 256;
var MAX_AUTH_STATES = 256;
var CODE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
var sessions = /* @__PURE__ */ new Map();
var pendingAuthStates = /* @__PURE__ */ new Map();
var AUTH_BRIDGE_KEY = /* @__PURE__ */ Symbol.for("eiscore.dsh.auth-bridge");
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
function gatewayOrigin() {
  const raw = text(process.env.EISCORE_GATEWAY_URL) || "http://127.0.0.1:8078";
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname && url.pathname !== "/") return "";
    return url.origin;
  } catch {
    return "";
  }
}
function authGatewayOrigin() {
  const raw = text(process.env.EISCORE_AUTH_GATEWAY_URL) || text(process.env.EISCORE_GATEWAY_URL) || "http://127.0.0.1:8078";
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname && url.pathname !== "/") return "";
    return url.origin;
  } catch {
    return "";
  }
}
function authOrigin() {
  const raw = text(process.env.EISCORE_AUTH_URL) || gatewayOrigin();
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return "";
    return url.origin;
  } catch {
    return "";
  }
}
function publicRequestOrigin(request) {
  const forwardedProto = text(request.headers.get("x-forwarded-proto")).split(",")[0].trim();
  const forwardedHost = text(request.headers.get("x-forwarded-host")).split(",")[0].trim();
  if (["http:", "https:"].includes(`${forwardedProto}:`) && forwardedHost && /^[A-Za-z0-9.-]+(?::\d+)?$/.test(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  try {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}
function authOriginForRequest(request) {
  if (!text(process.env.EISCORE_AUTH_URL)) return publicRequestOrigin(request) || authOrigin();
  return authOrigin();
}
function cookieValue(request, name) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const at = part.indexOf("=");
    if (at !== -1 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return "";
}
function purge() {
  const now = Date.now();
  for (const [id, session] of sessions) if (!session || session.expiresAt <= now) sessions.delete(id);
  for (const [id, expiresAt] of pendingAuthStates) if (expiresAt <= now) pendingAuthStates.delete(id);
  while (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value || "");
  while (pendingAuthStates.size > MAX_AUTH_STATES) pendingAuthStates.delete(pendingAuthStates.keys().next().value || "");
}
function sessionToken(request) {
  purge();
  const id = cookieValue(request, SESSION_COOKIE);
  const session = id ? sessions.get(id) : void 0;
  if (!session || session.expiresAt <= Date.now()) {
    if (id) sessions.delete(id);
    return "";
  }
  return session.token;
}
function installBridge() {
  const root = globalThis;
  root[AUTH_BRIDGE_KEY] = { token: sessionToken, toolToken: businessBindings.toolToken };
}
function json(value, status = 200, headers = {}) {
  return Response.json(value, { status, headers: { "cache-control": "no-store", ...headers } });
}
function decodeClaims(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return {};
    const value = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
function publicClaims(token) {
  const claims = decodeClaims(token);
  return {
    id: text(claims.sub || claims.username),
    username: text(claims.username || claims.sub),
    role: text(claims.app_role || claims.role),
    tenant_id: text(claims.tenant_id || claims.tenantId)
  };
}
async function consumeHandoff(code) {
  const origin = authGatewayOrigin();
  if (!origin || !CODE_PATTERN.test(code)) return null;
  try {
    const response = await fetch(`${origin}/company-site/auth/handoff/consume`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ code })
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const token = text(payload.token);
    if (!token || !token.includes(".")) return null;
    const claims = decodeClaims(token);
    const exp = Number(claims.exp);
    if (!Number.isFinite(exp) || exp * 1e3 <= Date.now()) return null;
    return { token, claims };
  } catch {
    return null;
  }
}
async function authStart(request) {
  const origin = authOriginForRequest(request);
  if (!origin) return json({ code: "EISCORE_AUTH_CONFIG_INVALID" }, 503);
  const dshReturn = new URL("/harness-embed-api/eiscore/auth/handoff", origin).href;
  const target = new URL("/login", origin);
  purge();
  const state = randomBytes(24).toString("base64url");
  pendingAuthStates.set(state, Date.now() + AUTH_STATE_TTL_MS);
  target.searchParams.set("dsh_return", dshReturn);
  target.searchParams.set("dsh_client", "deepseek-harness");
  return json({ url: target.href, origin }, 200, {
    "set-cookie": `${AUTH_STATE_COOKIE}=${state}; Max-Age=${Math.floor(AUTH_STATE_TTL_MS / 1e3)}; Path=/; HttpOnly; SameSite=Strict`
  });
}
async function authStatus(request) {
  const token = sessionToken(request);
  if (!token) return json({ authenticated: false }, 401);
  return json({ authenticated: true, user: publicClaims(token) });
}
async function authHandoff(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ code: "BAD_REQUEST" }, 400);
  }
  const code = text(body?.code);
  if (!CODE_PATTERN.test(code)) return json({ code: "INVALID_HANDOFF" }, 400);
  purge();
  const state = cookieValue(request, AUTH_STATE_COOKIE);
  if (!state || !pendingAuthStates.has(state)) return json({ code: "AUTH_STATE_INVALID" }, 403);
  pendingAuthStates.delete(state);
  const handoff = await consumeHandoff(code);
  if (!handoff) return json({ code: "HANDOFF_EXPIRED" }, 410);
  purge();
  const id = randomBytes(32).toString("base64url");
  const exp = Number(handoff.claims.exp) * 1e3;
  const expiresAt = Math.min(Date.now() + SESSION_TTL_MS, exp);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return json({ code: "HANDOFF_EXPIRED" }, 410);
  sessions.set(id, { token: handoff.token, expiresAt });
  purge();
  return json({ authenticated: true, user: publicClaims(handoff.token) }, 200, {
    "set-cookie": `${SESSION_COOKIE}=${id}; Max-Age=${Math.floor((expiresAt - Date.now()) / 1e3)}; Path=/; HttpOnly; SameSite=Strict`
  });
}
async function authLogout(request) {
  const id = cookieValue(request, SESSION_COOKIE);
  if (id) sessions.delete(id);
  return json({ authenticated: false }, 200, { "set-cookie": `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict` });
}
var inject = ["connection", "webServer"];
function apply(ctx) {
  installBridge();
  const routes = [
    { path: "/api/eiscore/auth/bind-session", methods: ["POST"], fetch: businessBindings.bind },
    { path: "/api/eiscore/auth/start", methods: ["POST"], fetch: authStart },
    { path: "/api/eiscore/auth/status", methods: ["GET"], fetch: authStatus },
    { path: "/api/eiscore/auth/handoff", methods: ["POST"], fetch: authHandoff },
    { path: "/api/eiscore/auth/logout", methods: ["POST"], fetch: authLogout }
  ];
  for (const route of routes) registerHttpRoute(ctx, { path: route.path, method: route.methods[0], fetch: route.fetch, maxRequestBodyBytes: 4096 });
}
export {
  apply,
  inject
};
