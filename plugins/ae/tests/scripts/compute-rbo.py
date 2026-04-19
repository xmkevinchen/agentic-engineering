#!/usr/bin/env python3
"""
compute-rbo.py — RBO + Jaccard@K + inclusion-stability + per-signal agreement
for the BL-005 Phase 2 scorer validation protocol.

Metric definitions per plan 042 Step 3 + discussion 041 conclusion:

1. RBO (Rank-Biased Overlap, p=0.90, extrapolated finite-list variant per
   Webber et al. 2010 "A Similarity Measure for Indefinite Rankings", §4 eq 32).
2. Jaccard@K where K = min(8, |included|) — scorer output cap is 8, not @10.
3. Inclusion stability = fraction of candidates with agreeing include/exclude.
4. Per-signal extraction agreement = Jaccard over project_tokens_extracted
   sets (measures token-extraction variance, the primary non-determinism source).

Input: pairs of session-output JSON files per profile (session-1.json +
session-2.json) with the schema defined in plan 042 Step 3.

Usage:
    python3 compute-rbo.py <profile-name> \
        <session-1.json> <session-2.json> \
        <manifest.json> \
        --out <profile>-metrics.json

Output: per-profile metrics JSON at fixtures/scorer-runs/<profile>-metrics.json
with structure:
    {
      "profile": "...",
      "rbo_p90": 0.XXX,
      "jaccard_at_k": 0.XXX,
      "k_used": N,
      "inclusion_stability": 0.XXX,
      "per_signal_extraction_agreement": 0.XXX,
      "verdict": "pass" | "empirical-divergence" | "fail",
      "tuning_bucket": "low-rbo-low-jaccard" | ... | null,
      "manifest_consistency": true | false,
      "computed_at": "..."
    }

Manifest consistency check: aborts with nonzero exit if session 1 and session 2
did NOT consume the same manifest_sha (structural integrity gate).

Author: BL-005 Phase 2 infra.
References:
  - Webber, Moffat, Zobel 2010 "A Similarity Measure for Indefinite Rankings"
    http://www.williamwebber.com/research/papers/wmz10_tois.pdf
  - Discussion 041 conclusion (codex tuning decision tree)
"""

from __future__ import annotations
import argparse
import json
import os
import sys
from datetime import datetime
from typing import Optional, List, Set


RBO_P = 0.90  # tuning parameter; higher p = shallower weighting
RBO_PASS_THRESHOLD = 0.85
RBO_FAIL_THRESHOLD = 0.75


def load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def included_ranked_ids(session: dict) -> List[str]:
    """Return list of library_qualified_id sorted by rank (1-indexed), included only."""
    scored = session.get("agents_scored", [])
    incl = [a for a in scored if a.get("included") is True]
    incl_sorted = sorted(
        incl,
        key=lambda a: (a.get("rank") if a.get("rank") is not None else 99999),
    )
    return [a["library_qualified_id"] for a in incl_sorted]


def rbo_extrapolated_finite(
    list_a: List[str], list_b: List[str], p: float = RBO_P
) -> float:
    """
    Extrapolated finite-list RBO per Webber, Moffat, Zobel 2010.

    RBO_ext(S, T, p) = (1 - p) * Σ_{d=1..L} p^{d-1} * A(d)   [observed portion]
                     + p^L * A(L)                              [tail extrapolation]

    where:
        L = max(|S|, |T|)
        A(d) = |S_1..d ∩ T_1..d| / d  (agreement ratio at depth d)

    Properties (tested in test_compute_rbo.py):
        - Identical lists: RBO = 1.0 exactly
        - Fully disjoint lists: RBO = 0.0
        - Empty ∩ empty: NaN (caller handles)
        - One empty: 0.0

    Tail extrapolation assumes "the agreement observed at depth L continues
    beyond the observed lists." For identical lists that's 1.0 (fills to 1.0
    total); for fully-divergent that's 0.0 (leaves the pure observed sum).
    """
    s = len(list_a)
    t = len(list_b)
    if s == 0 and t == 0:
        return float("nan")
    if s == 0 or t == 0:
        return 0.0

    L = max(s, t)

    set_a: Set[str] = set()
    set_b: Set[str] = set()

    # Sum of observed-portion contributions.
    observed_sum = 0.0
    agreement_at_L = 0.0

    for d in range(1, L + 1):
        if d <= s:
            set_a.add(list_a[d - 1])
        if d <= t:
            set_b.add(list_b[d - 1])
        intersection_size = len(set_a & set_b)
        agreement_d = intersection_size / d
        # Note: p^{d-1}, not p^d (matches the (1-p) normalization below)
        observed_sum += agreement_d * (p ** (d - 1))
        if d == L:
            agreement_at_L = agreement_d

    observed_portion = (1.0 - p) * observed_sum
    tail_portion = (p ** L) * agreement_at_L

    return observed_portion + tail_portion


def jaccard_at_k(list_a: List[str], list_b: List[str], k: int) -> float:
    """Jaccard similarity over top-K prefixes (included-only)."""
    top_a = set(list_a[:k])
    top_b = set(list_b[:k])
    union = top_a | top_b
    if len(union) == 0:
        return float("nan")
    return len(top_a & top_b) / len(union)


def inclusion_stability(session_a: dict, session_b: dict) -> float:
    """Fraction of candidates with agreeing included/excluded decisions."""
    by_id_a = {a["library_qualified_id"]: a.get("included", False)
               for a in session_a.get("agents_scored", [])}
    by_id_b = {a["library_qualified_id"]: a.get("included", False)
               for a in session_b.get("agents_scored", [])}
    all_ids = set(by_id_a) | set(by_id_b)
    if not all_ids:
        return float("nan")
    agree = sum(
        1 for aid in all_ids
        if by_id_a.get(aid, False) == by_id_b.get(aid, False)
    )
    return agree / len(all_ids)


def per_signal_extraction_agreement(
    session_a: dict, session_b: dict
) -> float:
    """Jaccard over project_tokens_extracted sets."""
    toks_a = set(session_a.get("project_tokens_extracted", []))
    toks_b = set(session_b.get("project_tokens_extracted", []))
    union = toks_a | toks_b
    if not union:
        return float("nan")
    return len(toks_a & toks_b) / len(union)


def classify_verdict(rbo: float) -> str:
    """Apply 3-state verdict per plan 042 AC5."""
    if rbo != rbo:  # NaN
        return "no-confident-match-both-sessions"
    if rbo >= RBO_PASS_THRESHOLD:
        return "pass"
    if rbo < RBO_FAIL_THRESHOLD:
        return "fail"
    return "empirical-divergence"


def classify_tuning_bucket(rbo: float, jaccard: float) -> Optional[str]:
    """Codex decision tree: low/high RBO × low/high Jaccard@K.

    High = ≥ 0.70 (same as Jaccard pass threshold); Low = below.
    Returns None for pass cases (no tuning needed).
    """
    if rbo != rbo or jaccard != jaccard:
        return None
    if rbo >= RBO_PASS_THRESHOLD and jaccard >= 0.70:
        return None  # pass — no tuning
    high_rbo = rbo >= RBO_PASS_THRESHOLD
    high_jac = jaccard >= 0.70
    if not high_rbo and high_jac:
        return "low-rbo-high-jaccard: order instability → tune weights"
    if not high_rbo and not high_jac:
        return "low-rbo-low-jaccard: extraction or noise-floor → tune extraction/normalization first"
    if high_rbo and not high_jac:
        return "high-rbo-low-jaccard: stable top-ranking, unstable boundary → tune noise-floor/threshold"
    # high+high but not pass: shouldn't happen given thresholds, but handle gracefully
    return "high-rbo-high-jaccard-but-not-pass: extraction unstable, aggregation masks it → add epsilon tie-band"


def manifest_consistency_check(session_a: dict, session_b: dict) -> bool:
    """Both sessions MUST have consumed the same manifest_sha."""
    sha_a = session_a.get("manifest_sha_consumed")
    sha_b = session_b.get("manifest_sha_consumed")
    if sha_a is None or sha_b is None:
        return False
    return sha_a == sha_b


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("profile", help="Profile name (e.g., mengdie)")
    parser.add_argument("session_1", help="Path to session-1.json")
    parser.add_argument("session_2", help="Path to session-2.json")
    parser.add_argument("manifest", help="Path to <profile>.json manifest")
    parser.add_argument("--out", required=True, help="Path to write metrics JSON")
    args = parser.parse_args()

    try:
        s1 = load_json(args.session_1)
        s2 = load_json(args.session_2)
        _manifest = load_json(args.manifest)  # Loaded for validation; not used directly
    except Exception as exc:
        print(f"ERROR loading inputs: {exc}", file=sys.stderr)
        return 2

    # Structural integrity: manifest consistency across sessions.
    consistent = manifest_consistency_check(s1, s2)
    if not consistent:
        print(
            "ERROR: Session 1 and Session 2 consumed different manifest_sha. "
            "Run is invalid — repeat with consistent manifest.",
            file=sys.stderr,
        )
        return 3

    list_a = included_ranked_ids(s1)
    list_b = included_ranked_ids(s2)
    k = min(8, max(len(list_a), len(list_b)))

    rbo = rbo_extrapolated_finite(list_a, list_b, p=RBO_P)
    jac = jaccard_at_k(list_a, list_b, k) if k > 0 else float("nan")
    incl = inclusion_stability(s1, s2)
    per_sig = per_signal_extraction_agreement(s1, s2)

    verdict = classify_verdict(rbo)
    bucket = classify_tuning_bucket(rbo, jac)

    metrics = {
        "profile": args.profile,
        "rbo_p90": rbo,
        "jaccard_at_k": jac,
        "k_used": k,
        "inclusion_stability": incl,
        "per_signal_extraction_agreement": per_sig,
        "verdict": verdict,
        "tuning_bucket": bucket,
        "manifest_consistency": consistent,
        "computed_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "session_1_manifest_sha": s1.get("manifest_sha_consumed"),
        "session_2_manifest_sha": s2.get("manifest_sha_consumed"),
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2, sort_keys=False)
        fh.write("\n")

    print(f"[{args.profile}] RBO={rbo:.4f} Jaccard@{k}={jac:.4f} "
          f"incl-stab={incl:.4f} per-sig={per_sig:.4f} → {verdict}")
    if bucket:
        print(f"  Tuning bucket: {bucket}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
