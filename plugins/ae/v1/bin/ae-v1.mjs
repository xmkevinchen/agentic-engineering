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

import { mkdirSync } from 'node:fs';

import { Kernel } from '../lib/kernel.mjs';
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
const COMMANDS = {
  status(kernel, args) {
    const [lineage, run] = require_(args, 'lineage', 'run');
    return kernel.status({ lineage, run });
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
