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

// Functions are mutable objects with their own typeof, so `typeof !== 'object'`
// walked straight past them — a frozen profile whose `include` predicate is a
// function reported as deeply frozen while the function itself was not. Their
// `prototype` is deliberately not walked: freezing a constructor's prototype
// changes how its instances behave, which is not this helper's business.
const isFreezable = (value) => value !== null
  && (typeof value === 'object' || typeof value === 'function');

const ownKeysToWalk = (value) => Object.getOwnPropertyNames(value)
  .filter((key) => !(typeof value === 'function' && key === 'prototype'));

export function deepFreeze(value) {
  if (!isFreezable(value)) return value;
  if (Object.isFrozen(value)) {
    // Already frozen at this level, but nested members may not be — a shallow
    // Object.freeze upstream is exactly the case this has to keep walking.
    for (const key of ownKeysToWalk(value)) {
      deepFreeze(value[key]);
    }
    return value;
  }
  Object.freeze(value);
  for (const key of ownKeysToWalk(value)) {
    deepFreeze(value[key]);
  }
  return value;
}

// True only if `value` and everything reachable from it is frozen. Used by the
// corpus to assert the property rather than trust that each producer remembered.
export function isDeeplyFrozen(value, seen = new Set()) {
  if (!isFreezable(value)) return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return ownKeysToWalk(value).every((key) => isDeeplyFrozen(value[key], seen));
}
