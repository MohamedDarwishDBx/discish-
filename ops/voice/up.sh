#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

"${SCRIPT_DIR}/render_config.sh"
docker-compose -f "${SCRIPT_DIR}/docker-compose.yml" up -d --force-recreate
docker-compose -f "${SCRIPT_DIR}/docker-compose.yml" ps

echo "Voice stack is up. LiveKit ws endpoint: ws://127.0.0.1:7880"
