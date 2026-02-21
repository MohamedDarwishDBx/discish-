#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
TEMPLATE_FILE="${SCRIPT_DIR}/livekit.yaml.template"
OUTPUT_FILE="${SCRIPT_DIR}/livekit.generated.yaml"

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${SCRIPT_DIR}/.env.example" "${ENV_FILE}"
  echo "Created ${ENV_FILE}. Fill required values first."
fi

set -a
source "${ENV_FILE}"
set +a

: "${LIVEKIT_API_KEY:?LIVEKIT_API_KEY is required}"
: "${LIVEKIT_API_SECRET:?LIVEKIT_API_SECRET is required}"
: "${TURN_DOMAIN:?TURN_DOMAIN is required}"

if [[ ${#LIVEKIT_API_SECRET} -lt 32 ]]; then
  echo "LIVEKIT_API_SECRET must be at least 32 characters." >&2
  exit 1
fi

python3 - "${TEMPLATE_FILE}" "${OUTPUT_FILE}" <<'PY'
import os
import re
import sys
from pathlib import Path

template = Path(sys.argv[1]).read_text()
pattern = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
rendered = pattern.sub(lambda m: os.environ.get(m.group(1), ""), template)
Path(sys.argv[2]).write_text(rendered)
PY

echo "Rendered ${OUTPUT_FILE}"
