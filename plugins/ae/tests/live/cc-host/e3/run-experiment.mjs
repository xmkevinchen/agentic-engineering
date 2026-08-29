#!/usr/bin/env node
// run-experiment.mjs — the runner that cannot start an arm nobody approved.
//
// The E3 result being replaced was produced by a runner that resolved its binary from PATH,
// inherited the ambient environment, and decided at run time what each arm would be. Every one of
// those is a way the thing that ran stops being the thing that was approved, and none of them
// leaves a trace afterwards. So this runner reads a protocol that already contains the answers —
// the exact launcher path AND its digest, the literal argv, the complete literal environment, the
// disposable roots — verifies them against the bytes on disk, and refuses rather than filling a
// gap in.
//
// M5 deliberately ships only the deterministic scaffold. `host_cli` remains a schema value so a
// future P0.7/P0.8 adapter can name what it intends to qualify, but this runner refuses that kind
// before planning or execution. There is no flag or authorization document that can promote the
// scaffold into a real host launcher.
//
// Attestation is collected, never synthesised. The launcher writes the arm's attestation record
// or it does not; when it does not, the arm's runtime attestation is `unavailable` with the facts,
// and verify-execution.sh will hold every contrast that depends on it to `inconclusive`. Filling
// that field in from a model's own report is the specific substitution this whole path exists to
// refuse.
//
// Usage:
//   node run-experiment.mjs --plan <protocol.json>
//       Validate the protocol and print the exact argv each arm would run. Starts nothing.
//   node run-experiment.mjs --execute <protocol.json> --authorization <auth.json> --result <out>
//       Run each arm once, in order, and seal the execution result.
//
// Exit 0 = planned or executed. 1 = refused, with the exact reason. 2 = usage.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const REFUSALS = [];
const refuse = (message) => { REFUSALS.push(message); };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function usage(message) {
  process.stderr.write(`run-experiment: ${message}\n`);
  process.stderr.write("usage: node run-experiment.mjs --plan <protocol.json>\n");
  process.stderr.write("       node run-experiment.mjs --execute <protocol.json> "
    + "--authorization <auth.json> --result <out>\n");
  process.exit(2);
}

function readJson(file, label) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    process.stderr.write(`run-experiment: ${label} is unreadable: ${error.message}\n`);
    process.exit(1);
  }
  return null;
}

function digestOf(file) {
  return sha256(readFileSync(file));
}

function isRegularFile(file) {
  try {
    const stat = lstatSync(file);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function under(root, candidate) {
  const normalisedRoot = path.resolve(root);
  const normalised = path.resolve(candidate);
  return normalised === normalisedRoot || normalised.startsWith(`${normalisedRoot}${path.sep}`);
}

// --- arguments -----------------------------------------------------------------------------

const args = process.argv.slice(2);
const options = { plan: null, execute: null, authorization: null, result: null };
for (let index = 0; index < args.length; index += 1) {
  const flag = args[index];
  const key = { "--plan": "plan", "--execute": "execute", "--authorization": "authorization",
                "--result": "result" }[flag];
  if (!key) usage(`unknown argument: ${flag}`);
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) usage(`${flag} needs a path`);
  if (options[key] !== null) usage(`${flag} given twice`);
  options[key] = value;
  index += 1;
}
if ((options.plan === null) === (options.execute === null)) usage("choose exactly one of --plan or --execute");
if (options.plan !== null && (options.authorization || options.result)) {
  usage("--plan starts nothing, so it takes no authorization or result path");
}
if (options.execute !== null && (!options.authorization || !options.result)) {
  usage("--execute needs both --authorization and --result");
}

const protocolPath = options.plan ?? options.execute;
if (!isRegularFile(protocolPath)) usage(`no such protocol file: ${protocolPath}`);
const protocol = readJson(protocolPath, "protocol");
const repo = (() => {
  let current = path.dirname(path.resolve(protocolPath));
  while (true) {
    if (existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.dirname(path.resolve(protocolPath));
    current = parent;
  }
})();

// --- the protocol must be the one that was approved ----------------------------------------

if (protocol.artifact_kind !== "e3_execution_protocol_v1" || protocol.artifact_version !== 1) {
  refuse(`artifact_kind ${JSON.stringify(protocol.artifact_kind)} is not an e3_execution_protocol_v1`);
}
if (protocol.authority !== "bootstrap_non_authoritative") {
  refuse("a protocol that claims authority beyond bootstrap evidence is not executable");
}

const preregistration = protocol.preregistration ?? {};
const preregistrationAbs = path.resolve(repo, preregistration.path ?? "");
if (!isRegularFile(preregistrationAbs)) {
  refuse(`the bound preregistration ${preregistration.path} is not a readable file`);
} else if (digestOf(preregistrationAbs) !== preregistration.sha256) {
  refuse(`the bound preregistration ${preregistration.path} does not hash to `
    + `${preregistration.sha256}; this protocol belongs to a different design`);
}

const gate = protocol.human_gate ?? {};
const launcher = protocol.launcher ?? {};
const launcherAbs = path.resolve(repo, launcher.path ?? "");
if (launcher.kind === "host_cli") {
  refuse("host_cli execution is deferred to P0.7/P0.8; this bootstrap runner is deterministic-scaffold-only");
} else if (launcher.kind !== "deterministic_fixture") {
  refuse(`launcher kind ${JSON.stringify(launcher.kind)} is not supported by this scaffold`);
}
if (!isRegularFile(launcherAbs)) {
  refuse(`the launcher ${launcher.path} is not a regular file`);
} else if (digestOf(launcherAbs) !== launcher.sha256) {
  refuse(`the launcher ${launcher.path} hashes to ${digestOf(launcherAbs)}, not the approved `
    + `${launcher.sha256}`);
}

// An interpreter's digest says nothing about what it interprets, so a fixture binds its script and
// every arm has to start with it. The host launcher gets no script at all: a wrapper between the
// approval and the host binary is exactly the layer nobody approved.
const launcherScript = protocol.launcher_script ?? null;
if (launcher.kind === "deterministic_fixture") {
  if (!launcherScript) {
    refuse("a deterministic fixture must bind the script its launcher interprets");
  } else {
    const scriptAbs = path.resolve(repo, launcherScript.path);
    if (!isRegularFile(scriptAbs)) {
      refuse(`the launcher script ${launcherScript.path} is not a regular file`);
    } else if (digestOf(scriptAbs) !== launcherScript.sha256) {
      refuse(`the launcher script ${launcherScript.path} hashes to ${digestOf(scriptAbs)}, not the `
        + `approved ${launcherScript.sha256}`);
    }
  }
} else if (launcherScript) {
  refuse("a host launcher runs no interposed script; the binary is the thing being approved");
}

const budgets = protocol.budgets ?? {};
const arms = Array.isArray(protocol.arms) ? protocol.arms : [];
if (arms.length < 2) refuse("a protocol with fewer than two arms has no contrast to run");
if (budgets.executor_retries !== 0) refuse("executor_retries must be 0; a retried arm is a second sample");
if (!Number.isInteger(budgets.max_processes) || budgets.max_processes < arms.length) {
  refuse(`max_processes ${budgets.max_processes} cannot cover ${arms.length} arm(s)`);
}

const tempRoot = protocol.temp_root ?? "";
if (!path.isAbsolute(tempRoot) || path.normalize(tempRoot) !== tempRoot) {
  refuse(`temp_root ${JSON.stringify(tempRoot)} is not a normalised absolute path`);
}

const seen = new Set();
for (const arm of arms) {
  const label = `arm ${arm.arm_id}`;
  if (seen.has(arm.arm_id)) refuse(`${label}: appears twice, so an arm could be added or renamed`);
  seen.add(arm.arm_id);
  if (!Array.isArray(arm.argv) || arm.argv.length < 1) {
    refuse(`${label}: has no literal argv, and a template expanded at run time is an argv nobody approved`);
  } else if (launcherScript && arm.argv[0] !== launcherScript.path) {
    refuse(`${label}: starts ${JSON.stringify(arm.argv[0])} rather than the bound launcher script `
      + `${launcherScript.path}`);
  }
  if (!arm.environment || typeof arm.environment !== "object" || Array.isArray(arm.environment)) {
    refuse(`${label}: has no literal environment, so it would inherit whatever this process carries`);
  }
  const isolation = arm.isolation ?? {};
  if (isolation.disposable !== true) refuse(`${label}: is not marked disposable`);
  for (const key of ["profile_root", "cache_root", "repo_root", "plugin_copy_root", "cleanup_manifest"]) {
    const value = isolation[key];
    if (typeof value !== "string" || !path.isAbsolute(value) || !under(tempRoot, value)) {
      refuse(`${label}: ${key} ${JSON.stringify(value)} is not inside the approved temp_root`);
    }
  }
  for (const key of ["raw_output", "attestation"]) {
    const value = (arm.output ?? {})[key];
    if (typeof value !== "string" || !path.isAbsolute(value) || !under(tempRoot, value)) {
      refuse(`${label}: output.${key} ${JSON.stringify(value)} is not inside the approved temp_root`);
    } else if (existsSync(value)) {
      refuse(`${label}: output.${key} already exists; an arm that overwrites can be re-run until it agrees`);
    }
  }
}

function stop() {
  if (!REFUSALS.length) return;
  for (const message of REFUSALS) process.stderr.write(`  refused: ${message}\n`);
  process.stderr.write(`run-experiment: ${REFUSALS.length} refusal(s)\n`);
  process.exit(1);
}

// --- plan ------------------------------------------------------------------------------------

if (options.plan !== null) {
  stop();
  process.stdout.write(`run-experiment: ${arms.length} arm(s) planned through `
    + `${launcher.kind} ${launcher.path}; nothing was started\n`);
  for (const arm of arms) {
    process.stdout.write(`  ${arm.arm_id} [${arm.axis_id}]: ${JSON.stringify([launcher.path, ...arm.argv])}\n`);
  }
  process.exit(0);
}

// --- execute ---------------------------------------------------------------------------------

if (gate.status !== "approved") {
  refuse(`the human gate is ${JSON.stringify(gate.status)}; an unapproved design does not run`);
}
if (!gate.decision_ref || !gate.decision_entry_sha256) {
  refuse("the human gate is approved with no decision reference and digest behind it");
}

if (!isRegularFile(options.authorization)) usage(`no such authorization file: ${options.authorization}`);
const authorization = readJson(options.authorization, "authorization");
if (authorization.artifact_kind !== "e3_execution_authorization_v1") {
  refuse(`authorization artifact_kind ${JSON.stringify(authorization.artifact_kind)} is not an `
    + "e3_execution_authorization_v1");
}
if (authorization.execution_authorized !== true) {
  refuse("the authorization does not authorize execution");
}
const boundProtocol = authorization.protocol ?? {};
if (path.resolve(repo, boundProtocol.path ?? "") !== path.resolve(protocolPath)) {
  refuse(`the authorization binds ${boundProtocol.path}, not the protocol it was given`);
} else if (boundProtocol.sha256 !== digestOf(protocolPath)) {
  refuse("the authorization binds a protocol digest that is not this protocol's bytes");
}
if (authorization.human_gate_decision_entry_sha256 !== gate.decision_entry_sha256) {
  refuse("the authorization and the protocol name different approval bytes");
}

// Only the deterministic branch is reachable in M5. An authorization file cannot widen it.
if (launcher.kind === "deterministic_fixture" && authorization.external_calls_authorized !== false) {
  refuse("a deterministic fixture cannot be authorized for external calls");
}

if (existsSync(options.result)) refuse(`the result path ${options.result} already exists`);

stop();

mkdirSync(tempRoot, { recursive: true, mode: 0o700 });

const armResults = [];
const externalCalls = 0;

for (const arm of arms) {
  if (launcher.kind !== "deterministic_fixture") {
    throw new Error("internal invariant: a non-fixture launcher reached the spawn loop");
  }
  for (const key of ["profile_root", "cache_root", "repo_root", "plugin_copy_root"]) {
    mkdirSync(arm.isolation[key], { recursive: true, mode: 0o700 });
  }
  mkdirSync(path.dirname(arm.output.raw_output), { recursive: true, mode: 0o700 });
  mkdirSync(path.dirname(arm.output.attestation), { recursive: true, mode: 0o700 });

  const started = spawnSync(launcherAbs, arm.argv, {
    env: arm.environment,
    cwd: arm.isolation.repo_root,
    encoding: "buffer",
    maxBuffer: 32 * 1024 * 1024,
  });
  const stdout = started.stdout ?? Buffer.alloc(0);
  const stderr = started.stderr ?? Buffer.alloc(0);
  writeFileSync(arm.output.raw_output, Buffer.concat([stdout, stderr]), { flag: "wx", mode: 0o600 });

  // Attestation is whatever the launcher wrote. Absence is an answer with facts, not a gap to fill.
  let attestation = {
    status: "unavailable",
    producer: null,
    record: null,
    correlated_arm_id: null,
    values: null,
    facts: [{
      fact: "the launcher emitted no host attestation record for this arm",
      observed_in: arm.output.attestation,
    }],
  };
  if (isRegularFile(arm.output.attestation)) {
    const emitted = JSON.parse(readFileSync(arm.output.attestation, "utf8"));
    attestation = {
      status: emitted.status === "available" ? "available" : "unavailable",
      producer: emitted.producer ?? null,
      record: { path: arm.output.attestation, sha256: digestOf(arm.output.attestation) },
      correlated_arm_id: emitted.correlated_arm_id ?? null,
      values: emitted.values ?? null,
      facts: Array.isArray(emitted.facts) ? emitted.facts : [],
    };
  }

  armResults.push({
    arm_id: arm.arm_id,
    axis_id: arm.axis_id,
    status: started.error ? "failed" : (started.status === 0 ? "completed" : "failed"),
    exit_code: started.status ?? null,
    raw_output: { path: arm.output.raw_output, sha256: digestOf(arm.output.raw_output) },
    runtime_attestation: attestation,
    backend_correlation: {
      status: "unavailable",
      producer: null,
      record: null,
      correlated_arm_id: null,
      values: null,
      facts: [{
        fact: "no backend correlation record was emitted for this arm",
        observed_in: arm.output.attestation,
      }],
    },
    confounders: [],
  });
}

const result = {
  artifact_kind: "e3_execution_result_v1",
  artifact_version: 1,
  authority: "bootstrap_non_authoritative",
  feature_id: protocol.feature_id,
  work_package: protocol.work_package,
  attempt_id: protocol.attempt_id,
  protocol: { path: path.relative(repo, path.resolve(protocolPath)), sha256: digestOf(protocolPath) },
  external_calls_made: externalCalls,
  arms: armResults,
  contrasts: [],
  prohibited_conclusions: [],
};

// The runner records what ran. It does not decide what the pairs mean: every contrast starts
// `inconclusive` and only verify-execution.sh, reading the attestation, can hold a different
// verdict to its evidence.
const prereg = readJson(preregistrationAbs, "preregistration");
for (const axis of prereg.axes ?? []) {
  const armIds = (axis.arms ?? []).map((arm) => arm.arm_id).filter((id) => seen.has(id));
  if (armIds.length < 2) continue;
  result.contrasts.push({
    axis_id: axis.axis_id,
    arm_ids: armIds,
    claim: axis.question,
    verdict: "inconclusive",
    basis: "the runner records execution only; a verdict is derived from the attestation, not from "
      + "the fact that both arms produced output",
  });
}
result.prohibited_conclusions = prereg.prohibited_conclusions ?? [];

writeFileSync(options.result, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
process.stdout.write(`run-experiment: ${armResults.length} arm(s) run through ${launcher.kind}; `
  + `${externalCalls} external call(s); result sealed at ${options.result}\n`);

// Nothing below the temp root is removed here. Each arm names a cleanup manifest, and that is the
// record of what to remove once the evidence has been read; deleting first would erase what ran.
