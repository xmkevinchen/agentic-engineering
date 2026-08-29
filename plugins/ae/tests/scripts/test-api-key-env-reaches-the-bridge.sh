#!/bin/sh
# The per-entry credential survives every link between the table and the backend.
#
# `pipeline.template.yml` lets a cross_family entry name the variable holding its
# backend's key. Three things have to carry it: the skill that spawns the seat, the
# seat's own invocation contract, and the bridge. The bridge learned it first
# (`BL-214`) and the two above it did not, so the field was documented, accepted at
# the far end, and unreachable (`BL-219`).
#
# The last check is the one that matters: it asks the built bundle what it accepts,
# rather than reading a third piece of prose. Two documents agreeing with each other
# would establish nothing about whether the field arrives anywhere.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../../.." && pwd)
exec node "$REPO/plugins/ae/tests/scripts/api-key-env-reaches-the-bridge.mjs"
