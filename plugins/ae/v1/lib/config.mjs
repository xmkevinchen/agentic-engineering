// What the Kernel needs to be constructed, resolved from outside any Contract.
//
// The Kernel takes six inputs and, until this file, every one of them came from a
// test fixture. That is what "no call sites" meant in practice: the machinery was
// complete and had never been supplied.
//
// Two of the six are deliberately absent here. `render` is not resolved because
// nothing in this entry point approves a Contract — approval is upstream, and a
// renderer supplied by the party presenting the view is that party judging its own
// presentation. `families` is not read from the repository; see below.

import { resolve } from 'node:path';

export const CONFIG_ENV = {
  root: 'AE_V1_ROOT',
  owner: 'AE_V1_OWNER',
  families: 'AE_V1_FAMILIES',
  sourceRoot: 'AE_V1_SOURCE_ROOT',
};

// Where the ledger and the Acceptances live. One directory, so a reader can scan
// it without being told what a feature is — the layout of the project's own work
// tracking is not this binary's business.
export function resolveRoot(env = process.env, cwd = process.cwd()) {
  const named = env[CONFIG_ENV.root];
  const root = named ? resolve(named) : resolve(cwd, '.ae', 'v1');
  return { root, logPath: resolve(root, 'log.ndjson'), completionRoot: resolve(root, 'completions') };
}

// Who the Human Owner is. Configured outside any Contract for the reason the
// Kernel states at its own field: reading the signer out of the Contract being
// approved lets one caller write a Contract naming itself.
export function resolveOwner(env = process.env) {
  const owner = env[CONFIG_ENV.owner];
  if (!owner) {
    const error = new Error(`no owner configured — set ${CONFIG_ENV.owner}`);
    error.code = 'config_owner_absent';
    throw error;
  }
  return owner;
}

// Which command reaches which family.
//
// **Not read from the repository.** The registry's whole purpose is that a
// producer cannot name the command that reviews it, and a project file is
// writable by any contributor from inside the same working tree a producer's
// Attempt runs in — sourcing it there inverts the boundary rather than keeping
// it. It is supplied at invocation, where `owner` already is.
//
// `pipeline.yml`'s `cross_family` is also the wrong shape: it is keyed by
// instance label carrying a `family` field, and label→family is many-to-one by
// design. Inverting it is ambiguous exactly when two labels share a family.
//
// Absent is not empty. A Kernel given no registry can obtain no review and says
// so; a Kernel given an empty one would claim to have looked.
export function resolveFamilies(env = process.env) {
  const raw = env[CONFIG_ENV.families];
  if (!raw) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const error = new Error(`${CONFIG_ENV.families} is not JSON`);
    error.code = 'config_families_unreadable';
    throw error;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const error = new Error(`${CONFIG_ENV.families} is not a family→command map`);
    error.code = 'config_families_unreadable';
    throw error;
  }
  for (const [family, command] of Object.entries(parsed)) {
    if (typeof command !== 'string' || !command) {
      const error = new Error(`family '${family}' names no command`);
      error.code = 'config_families_unreadable';
      throw error;
    }
  }
  return parsed;
}

export function resolveConfig({ env = process.env, cwd = process.cwd(), sourceRoot } = {}) {
  const { root, logPath, completionRoot } = resolveRoot(env, cwd);
  return {
    root,
    logPath,
    options: {
      completionRoot,
      sourceRoot: resolve(sourceRoot || env[CONFIG_ENV.sourceRoot] || cwd),
      owner: resolveOwner(env),
      families: resolveFamilies(env),
    },
  };
}
