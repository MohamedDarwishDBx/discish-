# Claude Code Handoff

Date: 2026-02-21
Project path: `/Users/mohamed.darwish/Documents/New project`
Target repo: `https://github.com/MohamedDarwishDBx/discish-`

## Goal
Deploy a Discord-like app publicly (Render + LiveKit Cloud), keep secrets out of GitHub, and make voice chat work for remote users.

## Stack
- Frontend: React + Vite (`src/`)
- Backend: FastAPI (`backend/app/`)
- DB: Postgres (SQLAlchemy + psycopg3)
- Voice: LiveKit

## Current Status
- Local app works on `http://127.0.0.1:5173`
- Local health checks were passing:
  - `/health`
  - `/health/ready` (database + voice true)
- Voice local issue was fixed by:
  - CSP `connect-src` allowing http/https/ws/wss
  - LiveKit `NODE_IP=127.0.0.1` for local Docker use
  - Frontend voice connect timeout so UI does not spin forever

## Cloud-Ready Changes Already Added
- `render.yaml` (Render Blueprint: web service + Postgres)
- `Dockerfile.app` supports `PORT` env on cloud
- `backend/app/db.py` normalizes DB URLs (`postgres://` and `postgresql://`)
- `backend/app/main.py`:
  - security headers
  - rate limiting
  - readiness endpoint
  - CORS fallback including Render hostname
  - CSP fix for LiveKit signaling
- `ops/cloud/README.md` deployment instructions
- `ops/cloud/smoke_test.sh` verification script

## Git State (Important)
- Local commits on `main`:
  - `4444b5f` Merge remote initial commit
  - `ebf50c7` Remove Python cache artifacts from repository
  - `cb3cc97` Prepare cloud deployment (Render + LiveKit Cloud)
- Remote `origin/main` only has:
  - `007938e` Initial commit (`README.md` only)
- Push failed with 403 because Git auth identity on this machine is different:
  - denied user: `mohamed-darwish_data`

## Security Note
- A LiveKit API key/secret was posted in chat screenshots.
- Rotate/revoke that key pair in LiveKit Cloud and use a new one in Render env vars.

## Files/Secrets Rules
- Keep secrets only in Render env vars.
- Never commit:
  - `.env`
  - `backend/.env`
  - `ops/voice/.env`
  - `ops/prod/.env`
- `.gitignore` already updated for this.

## What Claude Should Do Next
1. Push local commits to GitHub using correct credentials/PAT for `MohamedDarwishDBx`.
2. Deploy Render blueprint from `render.yaml`.
3. Set Render env vars:
   - `LIVEKIT_URL` = `wss://<project>.livekit.cloud`
   - `LIVEKIT_API_KEY` = new rotated key
   - `LIVEKIT_API_SECRET` = new rotated secret
4. Deploy latest commit.
5. Validate:
   - `https://<render-app>/health`
   - `https://<render-app>/health/ready`
6. Test voice from two browsers/users.

## Push Command (if needed)
```bash
cd "/Users/mohamed.darwish/Documents/New project"
git push -u origin main
```
If credentials mismatch, push with correct account/PAT for `MohamedDarwishDBx`.
