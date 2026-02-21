# Voice Infrastructure (LiveKit)

This app uses LiveKit for voice channels, with server-issued tokens from FastAPI.

## Local start

```bash
cd /Users/mohamed.darwish/Documents/New\ project
cp ops/voice/.env.example ops/voice/.env
# put your LIVEKIT_API_KEY + LIVEKIT_API_SECRET into ops/voice/.env
# keep NODE_IP=127.0.0.1 for single-machine local runs
chmod +x ops/voice/render_config.sh ops/voice/up.sh ops/voice/down.sh
ops/voice/up.sh
```

LiveKit runs on:
- `ws://127.0.0.1:7880` (signaling)
- `UDP 50000-50100` (media)
- `TCP 7881` (fallback media)
- `3478/udp` + `3478/tcp` (TURN)
- `5349/tcp` (TURN-TLS, optional when `TURN_TLS_PORT` > 0 and certs are configured)

## Backend env

Set matching keys in both `ops/voice/.env` and `backend/.env`:

```env
LIVEKIT_URL=ws://127.0.0.1:7880
LIVEKIT_API_KEY=replace-with-livekit-api-key
LIVEKIT_API_SECRET=replace-with-livekit-api-secret-min-32-chars
LIVEKIT_TOKEN_TTL_MIN=240
```

## Production-grade guidance

- Put LiveKit behind a domain and TLS (`wss://voice.yourdomain.com`).
- Run at least 3 LiveKit nodes with shared Redis for room state.
- TURN is enabled in LiveKit config; for strict enterprise networks use dedicated coturn edges per region.
- Keep regions close to users; place media nodes per region.
- Use autoscaling on CPU, packet loss, and active participant count.
- Persist app data in Postgres, keep media state in LiveKit + Redis.
