#!/bin/sh
# AE v1 — V1 Kernel suite.
#
# Every case names the acceptance criterion it exercises, so a failure says which
# Contract obligation broke rather than which function threw.
#
# Run: sh plugins/ae/tests/scripts/test-v1-kernel.sh
set -e
root=$(cd "$(dirname "$0")/../../../.." && pwd)
node "$root/plugins/ae/v1/test/all.mjs"
