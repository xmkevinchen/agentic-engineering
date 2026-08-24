// Deep freeze for producer-made values.
//
// A provenance brand records that an object passed through a producer. It says
// nothing about the object's *contents* — and a WeakSet keys on identity, so
// mutating a branded object in place leaves it branded. Without this, the whole
// producer/consumer pattern is defeated one level removed from where it looks
// like it works: instead of authoring a fake value, a caller takes a real one and
// edits it afterwards.
//
// `Object.freeze` alone is not enough, because it is shallow. A frozen snapshot
// whose `subject` and `entries` are still mutable can be made to claim it
// enumerated a directory it never read.
//
// Everything a producer hands out goes through here.

export function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) {
    // Already frozen at this level, but nested members may not be — a shallow
    // Object.freeze upstream is exactly the case this has to keep walking.
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze(value[key]);
    }
    return value;
  }
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze(value[key]);
  }
  return value;
}

// True only if `value` and everything reachable from it is frozen. Used by the
// corpus to assert the property rather than trust that each producer remembered.
export function isDeeplyFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.getOwnPropertyNames(value).every((key) => isDeeplyFrozen(value[key], seen));
}
