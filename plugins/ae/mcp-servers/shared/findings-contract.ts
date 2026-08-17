// findings-contract.ts — the review-findings output contract, in one place.
//
// Imported by every AE-owned bridge that can state a contract to a backend and validate the
// reply. It lives here rather than in one server because a second copy is a second validator,
// and two validators for one contract drift apart silently — which is the defect class F-082
// exists to close, so duplicating it to save a build change would be the wrong trade.
//
// The authority on the shape is `plugins/ae/tests/specs/findings-format.jq`; this is the runtime
// gate. `tests/scripts/test-findings-format-compliance.sh` asserts the two agree on the same
// payloads rather than trusting them to.
//
// NOT reachable from the codex path: that transport is the vendor CLI, so AE owns no code
// between the proxy and the backend and there is no boundary here to validate at. See
// § Decisions not implemented in F-082's plan.

// --- The findings output contract -----------------------------------------------------------
//
// Stated to the backend as a contract, and validated here. A reply that misses is reported as
// non-compliant and returned UNCHANGED alongside the reason; it is never coerced into shape.
// Reshaping is the specific defect: the relay would be supplying severity and location the
// backend never produced, while the report still reads as the backend's.
//
// Validation lives at the bridge rather than in the proxy's prose because a prose instruction to
// an agent is not a detector. The proxy is told to report format failures, and did improvise
// that correctly at least once — but "the agent was asked to notice" and "something noticed"
// are the same distinction this whole feature is about.

export const SEVERITIES = ["P1", "P2", "P3"] as const;

export const FINDINGS_CONTRACT = [
  "Return ONLY a JSON object, no prose before or after it, in exactly this shape:",
  '{"findings":[{"severity":"P1|P2|P3","file":"<repo-relative path>","line":<positive integer, omit if the finding is about the whole file>,"summary":"<one sentence>","evidence":"<what in the source supports it, omit if none>"}]}',
  "",
  "severity is one of P1, P2, P3 and nothing else:",
  "  P1 — blocker: security, data loss, crash",
  "  P2 — should fix: logic, performance, maintainability",
  "  P3 — minor",
  "Do not invent another level. If nothing is wrong, return {\"findings\":[]} — an empty list is",
  "a valid answer and is not the same as failing to answer.",
  "Add no other top-level key. Do not summarise the findings outside the list.",
].join("\n");

export type Compliance =
  | { compliant: true; findings: unknown[] }
  | { compliant: false; violations: string[] };

/** Validates a backend reply against the findings contract. Mirrors
 *  `tests/specs/findings-format.jq` — that spec is the authority, this is the runtime gate, and
 *  a test asserts the two agree on the same samples rather than trusting them to. */
export function checkFindings(raw: string): Compliance {
  const violations: string[] = [];
  let doc: any;
  try {
    doc = JSON.parse(raw.trim());
  } catch {
    return {
      compliant: false,
      // Deliberately not "extract the JSON from the prose": pulling a JSON object out of a
      // chatty reply is reshaping, and it silently converts a backend that ignored the contract
      // into one that honoured it.
      violations: ["reply is not JSON — the contract asks for a JSON object and nothing else"],
    };
  }

  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    return { compliant: false, violations: ["top level is not a JSON object"] };
  }
  if (!Object.prototype.hasOwnProperty.call(doc, "findings")) {
    violations.push("no `findings` key");
  } else if (!Array.isArray(doc.findings)) {
    violations.push("`findings` is not an array");
  }
  const extra = Object.keys(doc).filter((k) => k !== "findings");
  if (extra.length) violations.push(`unexpected top-level key(s): ${extra.join(", ")}`);

  if (Array.isArray(doc.findings)) {
    doc.findings.forEach((f: any, i: number) => {
      const at = `findings[${i}]`;
      if (f === null || typeof f !== "object" || Array.isArray(f)) {
        violations.push(`${at} is not an object`);
        return;
      }
      for (const key of ["severity", "file", "summary"]) {
        if (!Object.prototype.hasOwnProperty.call(f, key)) violations.push(`${at} has no \`${key}\``);
      }
      if (f.severity !== undefined && !SEVERITIES.includes(f.severity)) {
        violations.push(`${at}.severity is ${JSON.stringify(f.severity)}, not one of ${SEVERITIES.join("/")}`);
      }
      for (const key of ["file", "summary"]) {
        if (f[key] !== undefined && (typeof f[key] !== "string" || f[key].length === 0)) {
          violations.push(`${at}.${key} must be a non-empty string`);
        }
      }
      if (f.line !== undefined && (typeof f.line !== "number" || !Number.isInteger(f.line) || f.line <= 0)) {
        violations.push(`${at}.line must be a positive integer when present`);
      }
      if (f.evidence !== undefined && (typeof f.evidence !== "string" || f.evidence.length === 0)) {
        violations.push(`${at}.evidence must be a non-empty string when present`);
      }
    });
  }

  return violations.length ? { compliant: false, violations } : { compliant: true, findings: doc.findings };
}
