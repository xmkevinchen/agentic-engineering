// Minimal deterministic check harness shared by the foundation verifiers.
//
// Every check has a stable ID and exactly one expected result, so a failure
// names the frozen rule that broke rather than a line number.

import { FoundationError } from '../lib/errors.mjs';

export class Checks {
  constructor(section) {
    this.section = section;
    this.results = [];
    this.seen = new Set();
  }

  // The coverage floor scores `results.length`, so "every check has a stable ID"
  // has to be enforced rather than described: without this, repeating one no-op
  // check padded any section past its floor and the suite stayed green. A
  // duplicate is recorded as a failure rather than thrown so the run still
  // reports every other check.
  ok(id, condition, detail = '') {
    const full = `${this.section}/${id}`;
    if (this.seen.has(full)) {
      this.results.push({ id: full, ok: false, detail: `duplicate check id: ${full}` });
      return;
    }
    this.seen.add(full);
    this.results.push({ id: full, ok: Boolean(condition), detail });
  }

  // A skip is not a pass. It is always printed, so a check that could not run
  // cannot be mistaken for one that ran and succeeded.
  skip(id, reason) {
    const full = `${this.section}/${id}`;
    if (this.seen.has(full)) {
      this.results.push({ id: full, ok: false, detail: `duplicate check id: ${full}` });
      return;
    }
    this.seen.add(full);
    this.results.push({ id: full, ok: true, skipped: true, detail: reason });
  }

  equal(id, actual, expected) {
    const ok = actual === expected;
    this.ok(id, ok, ok ? '' : `expected ${JSON.stringify(expected)}, observed ${JSON.stringify(actual)}`);
  }

  equalBytes(id, actual, expected) {
    const ok = Buffer.isBuffer(actual) && Buffer.isBuffer(expected) && actual.equals(expected);
    this.ok(id, ok, ok ? '' : `expected ${describe(expected)}, observed ${describe(actual)}`);
  }

  notEqual(id, actual, unexpected) {
    const ok = actual !== unexpected;
    this.ok(id, ok, ok ? '' : `expected a value other than ${JSON.stringify(unexpected)}`);
  }

  // A rejection check passes only on the exact typed code. Rejecting for the
  // wrong reason is a failure: it means the fixture is not exercising the rule
  // it names.
  rejects(id, fn, expectedCode) {
    let observed = null;
    try {
      fn();
      this.ok(id, false, `expected rejection ${expectedCode}, but the call succeeded`);
      return;
    } catch (error) {
      if (!(error instanceof FoundationError)) {
        this.ok(id, false, `expected rejection ${expectedCode}, observed ${error.name}: ${error.message}`);
        return;
      }
      observed = error.code;
    }
    this.ok(id, observed === expectedCode, observed === expectedCode ? ''
      : `expected rejection ${expectedCode}, observed ${observed}`);
  }

  accepts(id, fn) {
    try {
      const value = fn();
      this.ok(id, true);
      return value;
    } catch (error) {
      this.ok(id, false, `expected acceptance, observed ${error.code ?? error.name}: ${error.message}`);
      return undefined;
    }
  }
}

function describe(buf) {
  if (!Buffer.isBuffer(buf)) return String(buf);
  const text = buf.toString('utf8');
  return /[\x00-\x1f]/.test(text) || buf.length > 120
    ? `${buf.length} bytes <${buf.toString('hex').slice(0, 96)}>`
    : JSON.stringify(text);
}

// A check cannot observe its own deletion, so something outside the sections has
// to hold the inventory. That is here.
//
// `expectedSections` names the sections that must reach this report: a section
// that is never handed over contributes no results and no failures, which is
// indistinguishable from a section with nothing to say — the coverage floor's own
// failures could be omitted entirely and the run still exited zero.
//
// `requiredIds` names checks that must appear within a section. The floor's own
// assertions are the ones that need it: they are what makes shrinking coverage
// visible, so their disappearance cannot be the thing nobody looks at.
//
// `write` is injectable so the inventory rules can be exercised without their
// output landing in the suite's.
export function report(sections, {
  verbose = false, expectedSections = [], requiredIds = {}, write = (t) => process.stdout.write(t),
} = {}) {
  const present = new Set(sections.map((s) => s.section));
  const all = sections.flatMap((s) => s.results);
  for (const name of expectedSections.filter((n) => !present.has(n))) {
    all.push({ id: `report/section-missing/${name}`, ok: false, detail: 'section never reached the report' });
  }
  for (const [section, ids] of Object.entries(requiredIds)) {
    const seen = new Set(sections.filter((s) => s.section === section).flatMap((s) => s.results.map((r) => r.id)));
    for (const id of ids.filter((i) => !seen.has(i))) {
      all.push({ id: `report/check-missing/${id}`, ok: false, detail: 'required check did not run' });
    }
  }
  const failures = all.filter((r) => !r.ok);
  const skipped = all.filter((r) => r.skipped);
  for (const result of all) {
    if (verbose || !result.ok || result.skipped) {
      const label = result.skipped ? 'SKIP' : (result.ok ? 'ok  ' : 'FAIL');
      write(`${label} ${result.id}${result.detail ? ` — ${result.detail}` : ''}\n`);
    }
  }
  const bySection = new Map();
  for (const result of all) {
    const section = result.id.split('/')[0];
    const counts = bySection.get(section) ?? { pass: 0, fail: 0, skip: 0 };
    if (result.skipped) counts.skip += 1;
    else if (result.ok) counts.pass += 1;
    else counts.fail += 1;
    bySection.set(section, counts);
  }
  for (const [section, counts] of bySection) {
    const skipNote = counts.skip ? `, ${counts.skip} skipped` : '';
    write(`[${section}] ${counts.pass} passed, ${counts.fail} failed${skipNote}\n`);
  }
  const ran = all.length - skipped.length;
  const skipNote = skipped.length ? ` (${skipped.length} skipped)` : '';
  write(`[total] ${ran - failures.length}/${ran} checks passed${skipNote}\n`);
  return failures.length;
}
