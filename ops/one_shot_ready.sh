#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="/tmp/discordclone-runtime"
LAUNCH_AGENT="${HOME}/Library/LaunchAgents/com.discordclone.app.plist"
TARGET_USER="${SUDO_USER:-${USER}}"
TARGET_UID="$(id -u "${TARGET_USER}")"

echo "[1/7] Ensuring Docker engine is available..."
if command -v colima >/dev/null 2>&1; then
  if ! colima status >/dev/null 2>&1; then
    colima start
  fi
fi

echo "[2/7] Bringing up voice stack..."
chmod +x "${ROOT_DIR}/ops/voice/render_config.sh" "${ROOT_DIR}/ops/voice/up.sh" "${ROOT_DIR}/ops/voice/down.sh"
"${ROOT_DIR}/ops/voice/up.sh"

echo "[3/7] Building frontend..."
cd "${ROOT_DIR}"
npm install
npm run build

echo "[4/7] Syncing backend/frontend to runtime..."
mkdir -p "${RUNTIME_DIR}/backend"
rm -rf "${RUNTIME_DIR}/backend/app" "${RUNTIME_DIR}/dist"
cp -R "${ROOT_DIR}/backend/app" "${RUNTIME_DIR}/backend/"
cp "${ROOT_DIR}/backend/requirements.txt" "${RUNTIME_DIR}/backend/requirements.txt"
cp "${ROOT_DIR}/backend/.env" "${RUNTIME_DIR}/backend/.env"
cp "${ROOT_DIR}/backend/.env.example" "${RUNTIME_DIR}/backend/.env.example"
cp "${ROOT_DIR}/backend/README.md" "${RUNTIME_DIR}/backend/README.md"
cp -R "${ROOT_DIR}/dist" "${RUNTIME_DIR}/dist"

echo "[5/7] Ensuring runtime python env..."
if [[ ! -x "${RUNTIME_DIR}/.venv/bin/python" ]]; then
  python3 -m venv "${RUNTIME_DIR}/.venv"
fi
"${RUNTIME_DIR}/.venv/bin/pip" install -r "${RUNTIME_DIR}/backend/requirements.txt"

if [[ ! -f "${RUNTIME_DIR}/run_app.sh" ]]; then
  cat > "${RUNTIME_DIR}/run_app.sh" <<'EOF'
#!/bin/zsh
set -e
cd /tmp/discordclone-runtime/backend
exec /tmp/discordclone-runtime/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 5173
EOF
  chmod +x "${RUNTIME_DIR}/run_app.sh"
fi

echo "[6/7] Ensuring launch agent..."
mkdir -p "$(dirname "${LAUNCH_AGENT}")"
if [[ ! -f "${LAUNCH_AGENT}" ]]; then
  cat > "${LAUNCH_AGENT}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.discordclone.app</string>
  <key>ProgramArguments</key>
  <array>
    <string>${RUNTIME_DIR}/run_app.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${RUNTIME_DIR}/backend</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/discordclone-app.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/discordclone-app.err.log</string>
</dict>
</plist>
EOF
fi

launchctl bootout "gui/${TARGET_UID}/com.discordclone.app" >/dev/null 2>&1 || true
launchctl bootstrap "gui/${TARGET_UID}" "${LAUNCH_AGENT}" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/${TARGET_UID}/com.discordclone.app" >/dev/null 2>&1 || true

echo "[7/7] Final health checks..."
for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:5173/health >/dev/null; then
    break
  fi
  sleep 1
done
curl -sf http://127.0.0.1:5173/health >/dev/null

for _ in $(seq 1 20); do
  if curl -sf http://127.0.0.1:5173/health/ready >/dev/null; then
    break
  fi
  sleep 1
done
docker-compose -f "${ROOT_DIR}/ops/voice/docker-compose.yml" ps

echo ""
echo "Ready:"
echo "App:   http://127.0.0.1:5173"
echo "Voice: ws://127.0.0.1:7880"
