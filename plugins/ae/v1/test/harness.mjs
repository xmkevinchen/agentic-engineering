// A test harness small enough to read in one sitting.
//
// Every case names the criterion it exercises, so a failure says which Contract
// obligation broke rather than which function threw. `refuses` asserts the code,
// not the message: codes are the stable surface, messages are diagnostics.

let passed = 0;
const failures = [];
let current = '';

export function group(name, fn) {
  current = name;
  fn();
}

export function ok(what, value) {
  if (value === true) { passed += 1; return; }
  failures.push(`${current} — ${what}: expected true, got ${JSON.stringify(value)}`);
}

export function eq(what, actual, expected) {
  if (actual === expected) { passed += 1; return; }
  failures.push(`${current} — ${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// The shape most of this suite needs: a thing that must be refused, and refused
// for a named reason. A test that only asserts "it threw" would pass on a typo.
export function refuses(what, code, fn) {
  try {
    fn();
    failures.push(`${current} — ${what}: expected refusal ${code}, but it was accepted`);
  } catch (error) {
    if (error.code === code) { passed += 1; return; }
    failures.push(`${current} — ${what}: expected ${code}, got ${error.code || error.message}`);
  }
}

export function report() {
  for (const f of failures) console.log('not ok:', f);
  console.log(`\n${passed} passed, ${failures.length} failed`);
  return failures.length === 0;
}
