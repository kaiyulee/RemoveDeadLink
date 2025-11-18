#!/usr/bin/env bash
set -euo pipefail
python -m json.tool manifest.json >/dev/null
if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found; skipping field checks" >&2
  exit 0
fi
jq -e '.manifest_version==3 and (.name|length>0) and (.version|length>0) and (.action.default_popup|length>0)' manifest.json >/dev/null
echo "manifest.json looks valid"