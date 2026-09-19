# Deployment

Production deployment guide for the Riva AI backend on an Oracle Cloud ARM64 Ubuntu VPS.

---

## Frontend Deployment (Netlify)

The Next.js frontend is deployed as a **static export** on Netlify.

### Why static export

Every page and component in the frontend uses `"use client"` with no server-side features (`next/headers`, server actions, route handlers, or API routes). `output: "export"` in `next.config.ts` instructs Next.js to emit a plain HTML/CSS/JS bundle to `frontend/out/`, which Netlify serves directly without requiring any server runtime.

### Build settings

A `netlify.toml` at the repository root locks in the correct settings:

```toml
[build]
  base    = "frontend"
  command = "npm run build"
  publish = "frontend/out"
```

### Netlify environment variable

Set in the Netlify dashboard under **Site settings → Environment variables**:

```env
NEXT_PUBLIC_API_URL=https://api.ai.shahidur.me
```

### Routing

`trailingSlash: true` is set in `next.config.ts`. This ensures each route is exported as `route/index.html` rather than `route.html`, which is required for correct Netlify path resolution.

---

## Infrastructure

| Component | Details |
|---|---|
| VPS | Oracle Cloud — Ubuntu 22.04 LTS, ARM64 (aarch64) |
| Runtime | Docker, Docker Compose |
| Backend container | `riva-api` — built from `backend/Dockerfile` |
| AI runtime | Existing `ollama` Docker container on the same host |
| Docker network | `riva-network` |
| Reverse proxy | Caddy |
| TLS | Managed automatically by Caddy (ACME / Let's Encrypt) |
| Database | Neon Serverless PostgreSQL — external, accessed over TLS |
| Public API domain | `api.ai.shahidur.me` |

---

## Prerequisites

- Ubuntu ARM64 VPS with a public IP address
- Domain DNS `api.ai.shahidur.me` pointing to the VPS
- Docker and Docker Compose installed
- Caddy installed and running
- An existing `ollama` Docker container running on the same host, with `llama3.1:8b` pulled
- A Neon PostgreSQL project with the connection URL available

---

## Repository Setup

Clone the repository on the VPS:

```bash
git clone https://github.com/Shahidur8381/RivaAI---A-friendly-AI-assistant.git
cd RivaAI---A-friendly-AI-assistant
```

---

## Environment Configuration

Copy the production environment template:

```bash
cp .env.production.example .env
```

Edit `.env` and populate all values:

```env
# Ollama endpoint — reachable through Docker network
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_KEEP_ALIVE=30m
OLLAMA_NUM_CTX=2048
OLLAMA_NUM_PREDICT=-1
OLLAMA_TEMPERATURE=0.7

# Neon PostgreSQL connection string
DATABASE_URL=postgresql://<user>:<password>@<host>/<dbname>?sslmode=require

# JWT signing secret — use a long random string
JWT_SECRET=<generate-a-strong-random-secret>

# Comma-separated allowed frontend origins
ALLOWED_ORIGINS=https://ai.shahidur.me
```

> **Never commit the `.env` file.** It is listed in `.gitignore`.

### Variable reference

| Variable | Purpose |
|---|---|
| `OLLAMA_BASE_URL` | HTTP endpoint for the Ollama container |
| `OLLAMA_MODEL` | Model name passed in every Ollama request |
| `OLLAMA_KEEP_ALIVE` | How long the model stays loaded in Ollama memory after a request |
| `OLLAMA_NUM_CTX` | Context window size (tokens) |
| `OLLAMA_NUM_PREDICT` | Max tokens to generate per response (`-1` = unlimited) |
| `OLLAMA_TEMPERATURE` | Sampling temperature |
| `DATABASE_URL` | Full PostgreSQL connection string including SSL parameters |
| `JWT_SECRET` | Secret used to sign and verify JWT access tokens |
| `ALLOWED_ORIGINS` | CORS-allowed frontend origins |

---

## Docker Deployment

### Connect Ollama to the Riva network

The `riva-network` Docker network is created by the Compose file. The existing `ollama` container must be connected to this network so the backend can reach it by hostname:

```bash
docker network connect riva-network ollama
```

This only needs to be done once. The connection persists across container restarts.

### Build and start the backend

```bash
docker compose -f compose.production.yml up -d --build
```

Verify:

```bash
docker compose -f compose.production.yml ps
```

---

## Reverse Proxy / HTTPS

Add a Caddy site block for the API domain. Example `Caddyfile` entry:

```
api.ai.shahidur.me {
    reverse_proxy 127.0.0.1:8000
}
```

Caddy automatically obtains and renews TLS certificates. The backend container port `8000` is bound to `127.0.0.1` only — Caddy is the single ingress point.

Reload Caddy after editing:

```bash
caddy reload --config /etc/caddy/Caddyfile
```

---

## Database Initialization

The database schema is applied automatically at backend startup. `init_db()` in `database.py` runs `CREATE TABLE IF NOT EXISTS` statements for the `users`, `chats`, `messages`, and `settings` tables, and seeds the `maintenance_mode` settings row.

On an existing database, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` guards are applied for the `is_admin` and `disabled` columns to handle schema migrations without data loss.

No manual migration step is required on first deployment.

---

## Health Check

The backend exposes a health endpoint:

```
GET https://api.ai.shahidur.me/api/health
```

Example response (all services healthy):

```json
{
  "status": "ok",
  "model": "llama3.1:8b",
  "ollama": true,
  "maintenance": false
}
```

| Field | Description |
|---|---|
| `status` | `"ok"` if Ollama is reachable, `"degraded"` if not, `"starting"` if the Ollama client is not yet initialized |
| `model` | Configured model name |
| `ollama` | Whether `GET /api/tags` on the Ollama container returned 200 |
| `maintenance` | Current maintenance mode state from the database |

The Docker Compose health check polls this endpoint every 30 seconds.

---

## Updating Deployment

```bash
# Pull latest code
git pull origin main

# Rebuild and restart the container
docker compose -f compose.production.yml up -d --build

# Verify the container is healthy
docker compose -f compose.production.yml ps
curl https://api.ai.shahidur.me/api/health
```

The `restart: unless-stopped` policy means the container automatically restarts after reboot without manual intervention.

---

## Troubleshooting

**Check running containers:**

```bash
docker ps
docker compose -f compose.production.yml ps
```

**View backend logs:**

```bash
docker logs riva-api
docker logs riva-api --follow
```

**Check Ollama logs:**

```bash
docker logs ollama
```

**Check Caddy status:**

```bash
systemctl status caddy
journalctl -u caddy --since "1 hour ago"
```

**Check health endpoint directly from the VPS:**

```bash
curl http://127.0.0.1:8000/api/health
```

**Verify network connectivity between containers:**

```bash
docker network inspect riva-network
```

---

## Rollback

To roll back to the previous version:

```bash
# Identify the previous commit
git log --oneline -5

# Revert to a specific commit
git checkout <commit-hash>

# Rebuild
docker compose -f compose.production.yml up -d --build
```

To return to the latest commit:

```bash
git checkout main
git pull origin main
docker compose -f compose.production.yml up -d --build
```
