#!/bin/sh
# The openai-compat bridge sends the credential the caller named, and no other.
#
# `pipeline.template.yml` documents `api_key_env` on the openai-compat seat, so a
# cross_family entry can name the variable holding its backend's key. The bridge
# read one module-level key and attached it to every endpoint the caller named, so
# a second keyed backend could not be configured and a local endpoint that never
# asked for credentials received one anyway.
#
# What is asserted is the `authorization` header the endpoint received, never the
# arguments the caller passed: what the bridge sent is the claim, and what it was
# asked to send is not. The endpoint here is a real local HTTP server and the
# bridge is the built `dist/index.mjs` spoken to over stdio, because the committed
# bundle is what actually runs.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../../.." && pwd)
exec node "$REPO/plugins/ae/tests/scripts/openai-compat-per-endpoint-key.mjs"
