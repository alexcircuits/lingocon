#!/usr/bin/env node
// Generates Auth.js session-cookie test vectors for lingocon-api's Rust decoder.
//
// Every token is produced by the Auth.js code the Next app runs (`encode` from
// `@auth/core/jwt`, plus `jose` / `@panva/hkdf` for the deliberately malformed
// variants), and every expectation is cross-checked against Auth.js's own
// `getToken()` (real cookie parsing, chunk joining and decoding) before the file
// is written. A vector where Rust intentionally differs from Auth.js must say so
// in `divergence`.
//
// Regenerate from the repository root (needs `npm install` for node_modules):
//   node rust/crates/api/tests/fixtures/make-session-vectors.mjs > rust/crates/api/tests/fixtures/session-vectors.json
//
// The secret below is a throwaway used only by these fixtures.
import { readFileSync } from "node:fs"
import { encode, getToken } from "@auth/core/jwt"
import { EncryptJWT, base64url, calculateJwkThumbprint } from "jose"
import { hkdf } from "@panva/hkdf"

const SECRET = "lingocon-session-vectors-test-secret-not-for-production"
const OTHER_SECRET = "a-different-secret-that-must-not-decrypt-these-vectors"
const PLAIN = "authjs.session-token"
const SECURE = "__Secure-authjs.session-token"

const repoRoot = new URL("../../../../../", import.meta.url)
const authCorePkg = JSON.parse(readFileSync(new URL("node_modules/@auth/core/package.json", repoRoot), "utf8"))
// SessionStore is not exported from the package; import the file the app uses.
const { SessionStore } = await import(new URL("node_modules/@auth/core/lib/utils/cookie.js", repoRoot).href)

const quietLogger = { debug() {}, warn() {}, error() {} }
const now = () => Math.floor(Date.now() / 1000)

async function derive(secret, salt, enc = "A256CBC-HS512") {
  const length = enc === "A256GCM" ? 32 : 64
  return hkdf("sha256", secret, salt, `Auth.js Generated Encryption Key (${salt})`, length)
}

async function thumbprint(key) {
  return calculateJwkThumbprint({ kty: "oct", k: base64url.encode(key) }, `sha${key.byteLength << 3}`)
}

/** Hand-rolled token for cases Auth.js's `encode` cannot produce (custom header / enc). */
async function rawToken({ payload, secret = SECRET, salt = PLAIN, enc = "A256CBC-HS512", kid }) {
  const key = await derive(secret, salt, enc)
  const header = { alg: "dir", enc }
  if (kid === "auto") header.kid = await thumbprint(key)
  else if (kid !== undefined) header.kid = kid
  return new EncryptJWT(payload)
    .setProtectedHeader(header)
    .setIssuedAt()
    .setExpirationTime(now() + 3600)
    .encrypt(key)
}

/** Flip the first character of one compact-JWE segment (0 = header … 4 = tag). */
function tamper(token, segment) {
  const parts = token.split(".")
  const s = parts[segment]
  parts[segment] = (s[0] === "A" ? "B" : "A") + s.slice(1)
  return parts.join(".")
}

function withHeaderField(token) {
  const parts = token.split(".")
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"))
  header.x = 1
  parts[0] = Buffer.from(JSON.stringify(header)).toString("base64url")
  return parts.join(".")
}

const plainCookie = (value, extra = "") => `theme=dark; ${PLAIN}=${value}${extra}`

const vectors = []
async function add(name, { cookieHeader, secure = false, expect, divergence }) {
  vectors.push({ name, cookieHeader, secure, expect, ...(divergence ? { divergence } : {}) })
}

// 1. Ordinary sign-in token (main's jwt callback sets `id`; Auth.js sets `sub`).
await add("valid_plain_cookie", {
  cookieHeader: plainCookie(await encode({ token: { id: "user_valid", sub: "user_valid", name: "Ada" }, secret: SECRET, salt: PLAIN })),
  expect: { userId: "user_valid" },
})
// 2. HTTPS deployments use the __Secure- cookie and that name as the HKDF salt.
await add("valid_secure_cookie", {
  cookieHeader: `${SECURE}=${await encode({ token: { id: "user_secure", sub: "user_secure" }, secret: SECRET, salt: SECURE })}`,
  secure: true,
  expect: { userId: "user_secure" },
})
// 3. A token minted for the http cookie but sent as the __Secure- one: different salt, different key.
await add("secure_cookie_with_plain_salt", {
  cookieHeader: `${SECURE}=${await encode({ token: { id: "user_x" }, secret: SECRET, salt: PLAIN })}`,
  secure: true,
  expect: { error: "KeyIdMismatch" },
})
await add("expired", {
  cookieHeader: plainCookie(await encode({ token: { id: "user_expired" }, secret: SECRET, salt: PLAIN, maxAge: -60 })),
  expect: { error: "Expired" },
})
// Auth.js validates with a 15 s clock tolerance.
await add("expired_within_clock_tolerance", {
  cookieHeader: plainCookie(await encode({ token: { id: "user_tolerated" }, secret: SECRET, salt: PLAIN, maxAge: -5 })),
  expect: { userId: "user_tolerated" },
})
await add("not_yet_valid", {
  cookieHeader: plainCookie(await encode({ token: { id: "user_future", nbf: now() + 3600 }, secret: SECRET, salt: PLAIN })),
  expect: { error: "NotYetValid" },
})
await add("wrong_secret", {
  cookieHeader: plainCookie(await encode({ token: { id: "user_other" }, secret: OTHER_SECRET, salt: PLAIN })),
  expect: { error: "KeyIdMismatch" },
})
await add("wrong_secret_without_kid", {
  cookieHeader: plainCookie(await rawToken({ payload: { id: "user_other" }, secret: OTHER_SECRET })),
  expect: { error: "InvalidTag" },
})
// Auth.js accepts a token without `kid` (it then just tries the key).
await add("valid_without_kid", {
  cookieHeader: plainCookie(await rawToken({ payload: { id: "user_nokid" } })),
  expect: { userId: "user_nokid" },
})
await add("wrong_kid", {
  cookieHeader: plainCookie(await rawToken({ payload: { id: "user_kid" }, kid: "not-the-thumbprint" })),
  expect: { error: "KeyIdMismatch" },
})
const base = await encode({ token: { id: "user_tamper" }, secret: SECRET, salt: PLAIN })
await add("tampered_ciphertext", { cookieHeader: plainCookie(tamper(base, 3)), expect: { error: "InvalidTag" } })
await add("tampered_tag", { cookieHeader: plainCookie(tamper(base, 4)), expect: { error: "InvalidTag" } })
await add("tampered_iv", { cookieHeader: plainCookie(tamper(base, 2)), expect: { error: "InvalidTag" } })
await add("tampered_header", { cookieHeader: plainCookie(withHeaderField(base)), expect: { error: "InvalidTag" } })

// Large sessions are split by Auth.js's SessionStore into name.0, name.1, …
const big = await encode({ token: { id: "user_chunked", sub: "user_chunked", blob: "x".repeat(6000) }, secret: SECRET, salt: PLAIN })
const chunks = new SessionStore({ name: PLAIN, options: {} }, {}, quietLogger).chunk(big, {})
if (chunks.length < 2) throw new Error("expected the big token to be chunked")
await add("chunked_cookie_out_of_order", {
  cookieHeader: ["theme=dark", ...chunks.reverse().map((c) => `${c.name}=${c.value}`)].join("; "),
  expect: { userId: "user_chunked" },
})
const firstChunk = chunks.find((c) => c.name.endsWith(".0"))
await add("chunked_cookie_missing_chunk", {
  cookieHeader: `${firstChunk.name}=${firstChunk.value}`,
  expect: { error: "Malformed" },
})

// Fallback to `sub` when `id` is absent; no user claim at all means no user.
await add("sub_claim_only", {
  cookieHeader: plainCookie(await encode({ token: { sub: "user_sub" }, secret: SECRET, salt: PLAIN })),
  expect: { userId: "user_sub" },
})
await add("no_user_claims", {
  cookieHeader: plainCookie(await encode({ token: { name: "Nobody" }, secret: SECRET, salt: PLAIN })),
  expect: { userId: null },
})
await add("not_a_jwe", { cookieHeader: plainCookie("not-a-token"), expect: { error: "Malformed" } })
await add("a256gcm_token", {
  cookieHeader: plainCookie(await rawToken({ payload: { id: "user_gcm" }, enc: "A256GCM", kid: "auto" })),
  expect: { error: "UnsupportedHeader" },
  divergence:
    "Auth.js decode also accepts enc A256GCM, but its encode only ever emits A256CBC-HS512; the Rust service accepts only the latter.",
})

// Cross-check every expectation against Auth.js itself.
for (const v of vectors) {
  const payload = await getToken({
    req: { headers: { cookie: v.cookieHeader } },
    secret: SECRET,
    secureCookie: v.secure,
    logger: quietLogger,
  })
  const authjsUser = payload ? (payload.id ?? payload.sub ?? null) : undefined
  const authjsAccepts = payload !== null
  const rustAccepts = !("error" in v.expect)
  if (v.divergence) {
    if (authjsAccepts === rustAccepts) throw new Error(`${v.name}: declared divergence but Auth.js agrees`)
    continue
  }
  if (authjsAccepts !== rustAccepts) {
    throw new Error(`${v.name}: Auth.js ${authjsAccepts ? "accepts" : "rejects"} but the vector expects the opposite`)
  }
  if (rustAccepts && authjsUser !== v.expect.userId) {
    throw new Error(`${v.name}: Auth.js user ${authjsUser} != expected ${v.expect.userId}`)
  }
}

process.stdout.write(
  JSON.stringify(
    {
      generatedBy: `@auth/core ${authCorePkg.version} (encode/getToken) via make-session-vectors.mjs`,
      generatedAt: now(),
      secret: SECRET,
      clockToleranceSeconds: 15,
      vectors,
    },
    null,
    2
  ) + "\n"
)
