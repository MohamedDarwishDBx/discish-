# Backend (FastAPI + Postgres)

## Setup
1. Ensure Postgres is running (see root `docker-compose.yml`).
2. Create a virtualenv and install dependencies:

```bash
cd /Users/mohamed.darwish/Documents/New\ project/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. Copy env:

```bash
cp .env.example .env
```

4. Run the API:

```bash
uvicorn app.main:app --reload --port 8000
```

## Voice setup
The backend issues LiveKit voice tokens.

Add to `backend/.env`:

```env
LIVEKIT_URL=ws://127.0.0.1:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_TOKEN_TTL_MIN=240
```

## Endpoints
- `GET /health`
- `GET /health/ready`
- `POST /auth/register`
- `POST /auth/login`
- `GET /users/me`
- `GET /servers`
- `POST /servers`
- `POST /servers/{server_id}/join`
- `GET /servers/{server_id}/channels`
- `POST /servers/{server_id}/channels`
- `GET /channels/{channel_id}/messages`
- `POST /channels/{channel_id}/messages`
- `POST /voice/token`
- `WS /ws/channels/{channel_id}?token=...`
