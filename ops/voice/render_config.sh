#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
TEMPLATE_FILE="${SCRIPT_DIR}/livekit.yaml.template"
OUTPUT_FILE="${SCRIPT_DIR}/livekit.generated.yaml"

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${SCRIPT_DIR}/.env.example" "${ENV_FILE}"
  echo "Created ${ENV_FILE}. Fill real secrets before production use."
fi

set -a
source "${ENV_FILE}"
set +a

: "${LIVEKIT_API_KEY:?LIVEKIT_API_KEY is required in ops/voice/.env}"
: "${LIVEKIT_API_SECRET:?LIVEKIT_API_SECRET is required in ops/voice/.env}"

if [[ ${#LIVEKIT_API_SECRET} -lt 32 ]]; then
  echo "LIVEKIT_API_SECRET must be at least 32 characters." >&2
  exit 1
fi

: "${RTC_TCP_PORT:=7881}"
: "${RTC_PORT_RANGE_START:=50000}"
: "${RTC_PORT_RANGE_END:=50100}"
: "${RTC_USE_EXTERNAL_IP:=false}"

: "${TURN_ENABLED:=true}"
: "${TURN_DOMAIN:=127.0.0.1}"
: "${TURN_UDP_PORT:=3478}"
: "${TURN_TLS_PORT:=5349}"

python3 - "${TEMPLATE_FILE}" "${OUTPUT_FILE}" <<'PY'
import os
import re
import sys
from pathlib import Path

template_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])
template = template_path.read_text()

pattern = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")

def replace(match: re.Match[str]) -> str:
    key = match.group(1)
    return os.environ.get(key, "")

output = pattern.sub(replace, template)
output_path.write_text(output)
PY

echo "Rendered ${OUTPUT_FILE}"
