# Production Deployment Bundle

This folder contains a production-style stack:

- FastAPI app container (serves API + built frontend)
- Postgres
- LiveKit + Redis
- TLS reverse proxy (Caddy) for both app and voice domains
- TURN enabled in LiveKit config

## One-shot deploy

```bash
cd /Users/mohamed.darwish/Documents/New\ project
cp ops/prod/.env.example ops/prod/.env
# set real values in ops/prod/.env
chmod +x ops/prod/*.sh
ops/prod/up.sh
```

## Required DNS

Point these domains to your server:

- `APP_DOMAIN` -> app/API endpoint
- `LIVEKIT_DOMAIN` -> LiveKit signaling endpoint

## Backend/Voice URL alignment

The `app` service receives:

- `LIVEKIT_URL=wss://${LIVEKIT_DOMAIN}`
- `LIVEKIT_API_KEY/LIVEKIT_API_SECRET` matching `ops/prod/livekit.generated.yaml`

## Scale targets

- Run multiple app replicas behind a load balancer.
- Run multiple LiveKit nodes with shared Redis.
- Keep UDP media range open (`50000-52000/udp`).
- Add regional edges and autoscaling for app + LiveKit separately.
