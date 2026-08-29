#!/usr/bin/env node
// The entry point. Until this file the Kernel decided completion and nothing
// called it.
//
// It is not a command chain. Each subcommand is one Kernel operation, callable on
// its own, in any order the caller's work actually took — N10 bans a mandatory
// sequence, and this binary implements none.
//
// Exit classes, because a process that exits 0 says nothing on its own:
//   0  the operation was performed
//   1  the Kernel refused, with a named code
//   2  the invocation was wrong (unknown subcommand, missing argument, bad config)

import { mkdirSync, readFileSync } from 'node:fs';

import { Kernel } from '../lib/kernel.mjs';
import { identify } from '../lib/identity.mjs';
import { resolveConfig } from '../lib/config.mjs';

const EXIT_OK = 0;
const EXIT_REFUSED = 1;
const EXIT_MISUSE = 2;

function parseArgs(argv) {
  const [subcommand, ...rest] = argv;
  const args = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) {
      const error = new Error(`unexpected argument '${token}'`);
      error.exit = EXIT_MISUSE;
      throw error;
    }
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) { args[key] = true; continue; }
    args[key] = next; i += 1;
  }
  return { subcommand, args };
}

function require_(args, ...names) {
  for (const name of names) {
    if (typeof args[name] !== 'string' || !args[name]) {
      const error = new Error(`--${name} is required`);
      error.exit = EXIT_MISUSE;
      throw error;
    }
  }
  return names.map((n) => args[n]);
}

// Every subcommand is `(kernel, args) => result`. The result is printed as one
// JSON envelope; nothing here interprets it.
// A document arrives as a path, and the bytes and identity are derived here. A
// caller that supplied its own identity would be naming the identity of the very
// thing it is submitting.
function document(args, name = 'doc') {
  const [path] = require_(args, name);
  let bytes;
  try {
    bytes = readFileSync(path, 'utf8');
  } catch (error) {
    const wrapped = new Error(`--${name} is not readable: ${error.message}`);
    wrapped.exit = EXIT_MISUSE;
    throw wrapped;
  }
  return { bytes, identity: identify(bytes) };
}

const COMMANDS = {
  status(kernel, args) {
    const [lineage, run] = require_(args, 'lineage', 'run');
    return kernel.status({ lineage, run });
  },

  'issue-assignment': (kernel, args) => {
    const [lineage, run, actor] = require_(args, 'lineage', 'run', 'actor');
    const { bytes, identity } = document(args);
    return kernel.issueAssignment({ lineage, run, bytes, identity, actor });
  },

  'open-attempt': (kernel, args) => {
    const [lineage, run, producer, obligations, submitter] =
      require_(args, 'lineage', 'run', 'producer', 'obligations', 'submitter');
    return kernel.openAttempt({
      lineage, run, producer, submitter, obligations: obligations.split(','),
    });
  },

  // Named `run-observation` and not `run-command`: the command is resolved from
  // the approved Contract, never supplied here.
  'run-observation': (kernel, args) => {
    const [lineage, run, attempt, obligation, id, artifact] =
      require_(args, 'lineage', 'run', 'attempt', 'obligation', 'id', 'artifact');
    return kernel.runObservation({
      id, lineage, run, attempt: Number(attempt), obligation, artifact,
    });
  },

  'observe-input': (kernel, args) => {
    const [lineage, path] = require_(args, 'lineage', 'path');
    return kernel.observeInput({ lineage, path });
  },

  'record-package': (kernel, args) => {
    const [lineage, run, submitter] = require_(args, 'lineage', 'run', 'submitter');
    const { bytes, identity } = document(args);
    return kernel.recordPackage({ lineage, run, bytes, identity, submitter });
  },

  'submit-observation': (kernel, args) => {
    const [lineage, run, obligation, attempt, producer, artifact, pkg, commandResult,
      submitter, observation] =
      require_(args, 'lineage', 'run', 'obligation', 'attempt', 'producer', 'artifact',
        'pkg', 'command-result', 'submitter', 'observation');
    // `--observation` names the command this answers. Nothing here runs it — the
    // Contract's command was resolved and run by `run-observation`. It is a claim
    // the Kernel checks against the Contract (`observation_not_named`), so
    // auto-filling it from the Contract would make that refusal unreachable.
    return kernel.submitObservation({
      lineage, run, obligation, attempt: Number(attempt), producer, artifact,
      pkg, commandResult, submitter, observation,
    });
  },

  // The family is named; the registry resolves it. No command reaches this map.
  'obtain-review': (kernel, args) => {
    const [id, lineage, run, family, reviewer] =
      require_(args, 'id', 'lineage', 'run', 'family', 'reviewer');
    const findings = args.findings ? String(args.findings).split(',') : [];
    return kernel.obtainReview({ id, lineage, run, family, reviewer, findings });
  },

  'dispose-finding': (kernel, args) => {
    const [lineage, run, review, finding, disposition, actor] =
      require_(args, 'lineage', 'run', 'review', 'finding', 'disposition', 'actor');
    return kernel.disposeFinding({ lineage, run, review, finding, disposition, actor });
  },

  complete: (kernel, args) => {
    const [lineage, run, actor] = require_(args, 'lineage', 'run', 'actor');
    return kernel.complete({
      lineage, run, actor, acceptedReview: args['accepted-review'] || undefined,
    });
  },
};

function main(argv) {
  const { subcommand, args } = parseArgs(argv);
  if (!subcommand || subcommand === '--help') {
    process.stdout.write(`${Object.keys(COMMANDS).sort().join('\n')}\n`);
    return EXIT_MISUSE;
  }
  const command = COMMANDS[subcommand];
  if (!command) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: 'unknown_subcommand', subcommand })}\n`);
    return EXIT_MISUSE;
  }

  let config;
  try {
    config = resolveConfig({});
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.code || 'config_unreadable', message: error.message })}\n`);
    return EXIT_MISUSE;
  }

  // Setting up is not the Kernel working, so a failure here is not a refusal.
  // Left uncaught these exit 1 by Node's default, which is the code a refusal
  // uses — and the whole point of the classes is that those two are different.
  let kernel;
  try {
    mkdirSync(config.options.completionRoot, { recursive: true });
    kernel = new Kernel(config.logPath, config.options);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      ok: false, error: 'setup_failed', message: error.message,
    })}\n`);
    return EXIT_MISUSE;
  }

  try {
    const result = command(kernel, args);
    process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
    return EXIT_OK;
  } catch (error) {
    if (error.exit === EXIT_MISUSE) {
      process.stderr.write(`${JSON.stringify({ ok: false, error: 'misuse', message: error.message })}\n`);
      return EXIT_MISUSE;
    }
    // A refusal is the Kernel working, not the binary failing. The code is the
    // stable surface; the message is a diagnostic.
    process.stderr.write(`${JSON.stringify({
      ok: false, error: error.code || 'unknown', message: error.message, detail: error.detail,
    })}\n`);
    return EXIT_REFUSED;
  }
}

process.exit(main(process.argv.slice(2)));
