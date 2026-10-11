// Password safeguard tests: config.js must ship with a blank OBS password,
// and failure paths must never echo the secret value.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectPasswordAssignment, repoRoot } from "../scripts/lib.mjs";
import { readFileSync } from "node:fs";

const ROOT = repoRoot();
const CHECK = join(ROOT, "scripts", "check.mjs");

test("real config.js password is blank", () => {
  const src = readFileSync(join(ROOT, "config.js"), "utf8");
  const { found, blank } = inspectPasswordAssignment(src);
  assert.equal(found, true, "expected a password assignment in config.js");
  assert.equal(blank, true, "config.js password must be blank");
});

test("inspector accepts only empty literal passwords", () => {
  assert.deepEqual(inspectPasswordAssignment('password: ""'), { found: true, blank: true });
  assert.deepEqual(inspectPasswordAssignment("password: ''"), { found: true, blank: true });
  assert.deepEqual(inspectPasswordAssignment('password: "   "'), { found: true, blank: false });
  assert.deepEqual(inspectPasswordAssignment("password:''"), { found: true, blank: true });
});

test("inspector flags non-blank passwords", () => {
  assert.deepEqual(inspectPasswordAssignment('password: "s3cret hunter2"'), { found: true, blank: false });
  assert.deepEqual(inspectPasswordAssignment("password:'x'"), { found: true, blank: false });
});

test("check rejects a non-blank password without echoing it", () => {
  const dir = mkdtempSync(join(tmpdir(), "obs3d-pw-"));
  try {
    const secret = "SUPERSECRET_pw_9f8e7d6c5b";
    writeFileSync(join(dir, "config.js"), `window.STREAM_CONFIG = { audioReactive: { password: "${secret}" } };\n`);
    writeFileSync(join(dir, "index.html"), "<!doctype html><html><head></head><body></body></html>\n");
    let out = "";
    try {
      execFileSync(process.execPath, [CHECK, "--root", dir], { stdio: "pipe", encoding: "utf8" });
      assert.fail("check should have failed on non-blank password");
    } catch (e) {
      out = String(e.stdout || "") + String(e.stderr || "") + String(e.message || "");
      assert.match(out, /password must be blank/i);
    }
    assert.doesNotMatch(out, new RegExp(secret), "check output leaked the password value");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
