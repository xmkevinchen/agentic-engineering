#!/usr/bin/env python3
"""
Unit tests for compute-rbo.py — verify-first protocol per plan 042 Step 3
Doodlestein-strategic refinement. Catches "bare prefix-agreement instead of
extrapolated finite-list" silent implementation errors before real data is run.

Run: python3 test_compute_rbo.py

References (for tolerance bounds):
  - Webber, Moffat, Zobel 2010, equation 32 (extrapolated finite-list RBO)
  - Hand-computed reference values for simple cases are used for regression.
"""

import importlib.util
import os
import sys

# Dynamic import because compute-rbo.py uses a hyphenated filename.
HERE = os.path.dirname(os.path.abspath(__file__))
SPEC_PATH = os.path.join(HERE, "compute-rbo.py")
_spec = importlib.util.spec_from_file_location("compute_rbo", SPEC_PATH)
if _spec is None or _spec.loader is None:
    print(f"FAIL: could not load {SPEC_PATH}")
    sys.exit(1)
compute_rbo = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(compute_rbo)


def approx_equal(a: float, b: float, tol: float = 1e-3) -> bool:
    return abs(a - b) <= tol


def test_identical_lists_rbo_is_1() -> bool:
    """Webber 2010 property: RBO(S, S, p) = 1.0 exactly for any p ∈ (0, 1)."""
    lst = ["A", "B", "C", "D", "E"]
    rbo = compute_rbo.rbo_extrapolated_finite(lst, lst, p=0.90)
    ok = approx_equal(rbo, 1.0)
    print(f"{'PASS' if ok else 'FAIL'} test_identical_lists_rbo_is_1: "
          f"RBO={rbo:.4f} (expected 1.0)")
    return ok


def test_disjoint_lists_rbo_is_0() -> bool:
    """Webber 2010 property: fully disjoint ranked lists have RBO = 0.0."""
    a = ["A", "B", "C"]
    b = ["X", "Y", "Z"]
    rbo = compute_rbo.rbo_extrapolated_finite(a, b, p=0.90)
    ok = approx_equal(rbo, 0.0)
    print(f"{'PASS' if ok else 'FAIL'} test_disjoint_lists_rbo_is_0: "
          f"RBO={rbo:.4f} (expected 0.0)")
    return ok


def test_swapped_adjacent_pair() -> bool:
    """
    Known-answer case adapted from Webber 2010 Table 1 intuition:
    swapping an adjacent pair at the top of short lists produces a
    well-defined RBO strictly less than 1 and greater than the
    prefix-agreement baseline.

    Lists: [A, B, C] vs [B, A, C] at p=0.90.

    Step-by-step (extrapolated finite-list, Webber 2010):
      L = 3
      depth 1: |{A} ∩ {B}| = 0 → A(1) = 0/1 = 0.0
      depth 2: |{A, B} ∩ {B, A}| = 2 → A(2) = 2/2 = 1.0
      depth 3: |{A, B, C} ∩ {B, A, C}| = 3 → A(3) = 3/3 = 1.0

      observed_sum = 0*p^0 + 1*p^1 + 1*p^2 = 0 + 0.9 + 0.81 = 1.71
      observed_portion = (1 - 0.9) * 1.71 = 0.171
      tail = p^3 * A(3) = 0.729 * 1.0 = 0.729
      RBO = 0.171 + 0.729 = 0.900
    """
    a = ["A", "B", "C"]
    b = ["B", "A", "C"]
    rbo = compute_rbo.rbo_extrapolated_finite(a, b, p=0.90)
    expected = 0.900  # hand-computed above
    ok = approx_equal(rbo, expected, tol=0.001)
    print(f"{'PASS' if ok else 'FAIL'} test_swapped_adjacent_pair: "
          f"RBO={rbo:.4f} (expected {expected:.4f})")
    return ok


def test_prefix_agreement_not_same_as_extrapolated() -> bool:
    """
    Guardrail: if an implementer used bare prefix-agreement (the unextrapolated
    version) instead of Webber's eq 32, the result for identical finite lists
    of length N would be (1-p)/p * Σ_{d=1..N} p^d, NOT 1.0.

    For N=5, p=0.90: bare prefix = (1/9) * (0.9 + 0.81 + 0.729 + 0.6561 + 0.59049)
                                  = (1/9) * 3.68559 = 0.40951

    So if our rbo(identical, identical) returned ~0.41 instead of 1.0, we'd know
    we had the bare version. test_identical_lists_rbo_is_1 already catches this,
    but this test documents the expected bare-version value for reference.
    """
    lst = ["A", "B", "C", "D", "E"]
    rbo = compute_rbo.rbo_extrapolated_finite(lst, lst, p=0.90)
    bare_version = (1.0 - 0.90) / 0.90 * sum(0.90 ** d for d in range(1, 6))
    ok = not approx_equal(rbo, bare_version, tol=0.01)  # we want the NON-bare answer
    print(f"{'PASS' if ok else 'FAIL'} test_prefix_agreement_not_same_as_extrapolated: "
          f"RBO={rbo:.4f} (bare-version reference would be {bare_version:.4f}; "
          f"ours should be 1.0 for identical lists, not the bare value)")
    return ok


def test_empty_lists_returns_nan() -> bool:
    import math
    rbo = compute_rbo.rbo_extrapolated_finite([], [], p=0.90)
    ok = math.isnan(rbo)
    print(f"{'PASS' if ok else 'FAIL'} test_empty_lists_returns_nan: "
          f"RBO={rbo} (expected NaN)")
    return ok


def test_one_empty_returns_0() -> bool:
    rbo = compute_rbo.rbo_extrapolated_finite(["A"], [], p=0.90)
    ok = approx_equal(rbo, 0.0)
    print(f"{'PASS' if ok else 'FAIL'} test_one_empty_returns_0: "
          f"RBO={rbo:.4f} (expected 0.0)")
    return ok


def test_jaccard_at_k_basic() -> bool:
    a = ["A", "B", "C", "D"]
    b = ["A", "B", "X", "Y"]
    # Top-4: |{A,B,C,D} ∩ {A,B,X,Y}| = 2; |union| = 6 → 2/6 = 0.333
    jac = compute_rbo.jaccard_at_k(a, b, k=4)
    ok = approx_equal(jac, 2 / 6, tol=0.001)
    print(f"{'PASS' if ok else 'FAIL'} test_jaccard_at_k_basic: "
          f"Jaccard@4={jac:.4f} (expected {2/6:.4f})")
    return ok


def test_inclusion_stability_all_agree() -> bool:
    s_a = {"agents_scored": [
        {"library_qualified_id": "x:a", "included": True},
        {"library_qualified_id": "x:b", "included": False},
    ]}
    s_b = {"agents_scored": [
        {"library_qualified_id": "x:a", "included": True},
        {"library_qualified_id": "x:b", "included": False},
    ]}
    stab = compute_rbo.inclusion_stability(s_a, s_b)
    ok = approx_equal(stab, 1.0)
    print(f"{'PASS' if ok else 'FAIL'} test_inclusion_stability_all_agree: "
          f"stab={stab:.4f} (expected 1.0)")
    return ok


def test_inclusion_stability_one_flip() -> bool:
    s_a = {"agents_scored": [
        {"library_qualified_id": "x:a", "included": True},
        {"library_qualified_id": "x:b", "included": True},
    ]}
    s_b = {"agents_scored": [
        {"library_qualified_id": "x:a", "included": True},
        {"library_qualified_id": "x:b", "included": False},
    ]}
    stab = compute_rbo.inclusion_stability(s_a, s_b)
    ok = approx_equal(stab, 0.5, tol=0.01)
    print(f"{'PASS' if ok else 'FAIL'} test_inclusion_stability_one_flip: "
          f"stab={stab:.4f} (expected 0.5)")
    return ok


def test_verdict_classification() -> bool:
    cases = [
        (0.90, "pass"),
        (0.80, "empirical-divergence"),
        (0.70, "fail"),
        (0.85, "pass"),    # boundary
        (0.75, "empirical-divergence"),  # boundary (0.75 exactly is ≥ 0.75)
    ]
    all_ok = True
    for rbo, expected in cases:
        got = compute_rbo.classify_verdict(rbo)
        ok = got == expected
        all_ok = all_ok and ok
        print(f"{'PASS' if ok else 'FAIL'} verdict_classification(RBO={rbo:.2f}): "
              f"got {got!r} (expected {expected!r})")
    return all_ok


def main() -> int:
    results = [
        test_identical_lists_rbo_is_1(),
        test_disjoint_lists_rbo_is_0(),
        test_swapped_adjacent_pair(),
        test_prefix_agreement_not_same_as_extrapolated(),
        test_empty_lists_returns_nan(),
        test_one_empty_returns_0(),
        test_jaccard_at_k_basic(),
        test_inclusion_stability_all_agree(),
        test_inclusion_stability_one_flip(),
        test_verdict_classification(),
    ]
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"\n{passed}/{total} tests passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
