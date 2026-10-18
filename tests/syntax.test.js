import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const browserScripts = [
  "src/app.js",
  "src/version-history.js",
  "src/life-suite.js",
  "src/account-portal.js",
];

for (const relativePath of browserScripts) {
  test(`JavaScript syntax: ${relativePath}`, () => {
    const filePath = resolve(process.cwd(), relativePath);
    assert.ok(existsSync(filePath), `Expected source file to exist: ${relativePath}`);
    const result = spawnSync(process.execPath, ["--check", filePath], {
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      [result.stdout, result.stderr].filter(Boolean).join("\n") ||
        `Node syntax check failed for ${relativePath}`,
    );
  });
}
