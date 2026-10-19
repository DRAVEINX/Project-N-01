import test from "node:test";
import assert from "node:assert/strict";
import { extractBearerSessionToken } from "../src/server/bearer-token.js";

const token = "A".repeat(43);

test("extracts a valid bearer token from Node-style and Fetch headers", () => {
  assert.equal(extractBearerSessionToken({ headers: { authorization: `Bearer ${token}` } }), token);
  assert.equal(extractBearerSessionToken({ headers: { Authorization: `Bearer ${token}` } }), token);
  assert.equal(extractBearerSessionToken({ headers: new Headers({ authorization: `Bearer ${token}` }) }), token);
});

test("accepts case-insensitive bearer scheme but returns token unchanged", () => {
  assert.equal(extractBearerSessionToken({ headers: { authorization: `bEaReR ${token}` } }), token);
});

test("rejects missing, malformed, short, long, or non-bearer credentials", () => {
  for (const request of [
    undefined,
    {},
    { headers: {} },
    { headers: { authorization: `Basic ${token}` } },
    { headers: { authorization: "Bearer" } },
    { headers: { authorization: "Bearer too-short" } },
    { headers: { authorization: `Bearer ${"A".repeat(44)}` } },
    { headers: { authorization: `Bearer ${"A".repeat(42)}!` } },
    { headers: { authorization: [`Bearer ${token}`, `Bearer ${token}`] } },
    { headers: { authorization: `Bearer ${token}, Bearer ${token}` } },
    { headers: { authorization: `Bearer  ${token}` } }
  ]) {
    assert.equal(extractBearerSessionToken(request), null);
  }
});

test("does not treat query or body fields as credentials", () => {
  assert.equal(extractBearerSessionToken({
    headers: {},
    query: { token },
    body: { token }
  }), null);
});
