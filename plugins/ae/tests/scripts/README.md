# `plugins/ae/tests/scripts/` — standalone test scripts

Self-contained tests that run directly (no unified runner / CI harness exists for
this directory yet; each script documents its own run command in its header).

| Script | Run command | Covers |
|---|---|---|
| `test-check-shutdown-canonical.sh` | `sh plugins/ae/tests/scripts/test-check-shutdown-canonical.sh` | mutation/negative test for `scripts/check-shutdown-canonical.sh` — proves it exits 1 when a `"type": "shutdown_response"` sentinel is injected (closes the false-green gap left by the exit-0-only L1 fixtures) |
| `test_compute_rbo.py` | `python3 plugins/ae/tests/scripts/test_compute_rbo.py` | unit test for the (deprecated) `compute-rbo.py` 6-signal scorer |

Each script exits 0 on all-pass, non-zero on any failure.
