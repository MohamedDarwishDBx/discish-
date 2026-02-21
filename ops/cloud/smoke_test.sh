#!/usr/bin/env bash
set -euo pipefail

APP_URL="${1:-${APP_URL:-}}"
if [[ -z "${APP_URL}" ]]; then
  echo "Usage: $0 https://<your-app-domain>"
  exit 1
fi

APP_URL="${APP_URL%/}"

echo "Checking ${APP_URL}/health"
HEALTH_JSON="$(curl -fsS "${APP_URL}/health")"
echo "health: ${HEALTH_JSON}"

echo "Checking ${APP_URL}/health/ready"
READY_JSON="$(curl -fsS "${APP_URL}/health/ready")"
echo "ready: ${READY_JSON}"

python3 - "${READY_JSON}" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
checks = payload.get("checks", {})
if not checks.get("database"):
    raise SystemExit("database check failed")
if not checks.get("voice"):
    raise SystemExit("voice check failed")
print("smoke test passed")
PY
