#!/usr/bin/env bash
set -euo pipefail
zip -r RemoveDeadLink.zip manifest.json background.js ui _locales store icons
echo "Packed to RemoveDeadLink.zip"