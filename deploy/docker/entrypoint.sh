#!/bin/sh
set -eu
node --experimental-strip-types deploy/docker/check-chrome.mjs
exec "$@"
