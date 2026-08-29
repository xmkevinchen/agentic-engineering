#!/usr/bin/env node
// P0.G-lite candidate for the --plugin-dir support arm. It selects no caller-declared root:
// the exact host system-init plugin row, session id, and launch argv must agree, then the
// candidate manifest bytes are hashed. This emits observation only, never a capability.
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const fail = (message) => { process.stderr.write(`active-release-lite: ${message}\n`); process.exit(1); };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (process.argv.length !== 3) fail("usage: resolve-active-root.mjs <observation.json>");
let input;
try { input = JSON.parse(readFileSync(process.argv[2], "utf8")); }
catch (error) { fail(`unreadable observation: ${error.message}`); }

const allowed = ["artifact_kind", "artifact_version", "authority", "plugin_name",
                 "expected_session_id", "launch", "host_init", "candidates"];
const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
if (unknown.length) fail(`unknown caller field(s): ${unknown.join(", ")}`);
if (input.artifact_kind !== "p0g_active_release_observation_v1" ||
    input.artifact_version !== 1 || input.authority !== "none") {
  fail("observation kind/version/authority is not the P0.G-lite shape");
}
if (input.plugin_name !== "ae") fail("only the frozen ae plugin name is supported by this spike");
const init = input.host_init ?? {};
if (init.type !== "system" || init.subtype !== "init") fail("missing host system-init record");
if (!input.expected_session_id || init.session_id !== input.expected_session_id) {
  fail("host record is from a different session");
}
const rows = (init.plugins ?? []).filter((entry) => entry?.name === input.plugin_name);
if (rows.length !== 1) fail(`host init names ${rows.length} ae plugin rows; active root is not unique`);
const hostRow = rows[0];
if (hostRow.source !== "ae@inline") fail("this smoke supports only the --plugin-dir inline arm");
if (typeof hostRow.path !== "string" || !path.isAbsolute(hostRow.path)) {
  fail("host init plugin path is not absolute");
}

const argv = input.launch?.argv;
if (!Array.isArray(argv)) fail("launch argv is absent");
const selectors = [];
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === "--plugin-dir") selectors.push(argv[index + 1]);
}
if (selectors.length !== 1 || typeof selectors[0] !== "string") {
  fail("launch must contain exactly one --plugin-dir selector");
}
const cwd = input.launch?.cwd;
if (typeof cwd !== "string" || !path.isAbsolute(cwd)) fail("launch cwd is not absolute");
let selected;
try { selected = realpathSync(path.resolve(cwd, selectors[0])); }
catch { fail("the launch-selected plugin root does not exist"); }
let hostRoot;
try { hostRoot = realpathSync(hostRow.path); }
catch { fail("the host-emitted plugin root does not exist"); }
if (selected !== hostRoot) fail("launch selector and host system-init row resolve to different roots");

const candidates = Array.isArray(input.candidates) ? input.candidates : [];
const matches = candidates.filter((entry) => {
  try { return realpathSync(entry.root) === hostRoot; } catch { return false; }
});
if (matches.length !== 1) fail(`candidate set has ${matches.length} entries for the host-active root`);
const manifestPath = path.join(hostRoot, "release-manifest-v1.json");
let stat;
try { stat = lstatSync(manifestPath); } catch { fail("active candidate has no release-manifest-v1.json"); }
if (!stat.isFile() || stat.isSymbolicLink()) fail("active candidate manifest is not a regular file");
const actualDigest = sha256(readFileSync(manifestPath));
if (matches[0].manifest_sha256 !== actualDigest) fail("active candidate manifest digest does not match its bytes");

process.stdout.write(`${JSON.stringify({
  artifact_kind: "p0g_active_release_resolution_v1",
  authority: "none",
  qualification: false,
  support_arm: "macos-26.6.2-arm64-cc-2.1.231-plugin-dir",
  session_id: init.session_id,
  active_root: hostRoot,
  active_manifest_sha256: actualDigest,
  capability: null,
  result: "plausible",
})}\n`);
