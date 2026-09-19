# Security

Security practices and configuration for the Riva AI application.

---

## Secrets Management

- All secrets are provided through environment variables at runtime.
- `.env` files are listed in both the root and backend `.gitignore` — they are never committed.
- `.env.example` and `.env.production.example` contain only placeholder values. No real credentials appear in the repository.
- `JWT_SECRET` must be a strong, randomly generated string. The application raises `RuntimeError` at startup if `JWT_SECRET` is not set.
- `DATABASE_URL` contains the PostgreSQL credentials. It is passed via environment and never logged. The backend sanitizes error messages that might contain the DSN string.

---

## Network Exposure

| Service | Exposed | Where |
|---|---|---|
| HTTPS (443) | Public | Caddy handles TLS termination |
| HTTP (80) | Public | Caddy redirects to HTTPS |
| FastAPI backend | Private only | `127.0.0.1:8000` — bound to loopback, not reachable from the internet |
| Ollama API | Private only | Docker network only (`riva-network`) — no published ports |
| Neon PostgreSQL | External managed | TLS-only connection from the backend |

The API port `8000` is bound to `127.0.0.1` in the Docker Compose configuration:

```yaml
ports:
  - "127.0.0.1:8000:8000"
```

This means the FastAPI container cannot be reached directly from the public internet. All external traffic passes through Caddy.

---

## Docker Networking

The `riva-api` container and the `ollama` container communicate through a named Docker network (`riva-network`). Within this network, the backend reaches Ollama at `http://ollama:11434` — the container name serves as the hostname.

The Ollama container has no published ports exposed to the host network. This means:
- Ollama is not reachable from the internet.
- Ollama is not reachable from other processes on the VPS host (unless they are also on `riva-network`).
- The only service that can call Ollama is `riva-api`.

---

## Authentication

- Passwords are hashed with `bcrypt` (configurable rounds via the library default).
- Hashing is performed before storage. The plaintext password is never stored.
- The `bcrypt.checkpw()` function is used for comparison. Failed verification returns `False` rather than raising exceptions.
- Access tokens are JWTs signed with `HS256` and `JWT_SECRET`.
- Tokens contain `sub` (user ID as string), `role`, and `exp` (expiry) claims.
- Token expiry is set to **7 days**.
- Tokens are stored in the browser's `localStorage`.

---

## Authorization

Endpoint protection uses FastAPI `Security` dependencies:

| Dependency | Behaviour |
|---|---|
| `get_current_user` | Requires a valid JWT; returns user ID or raises 401 |
| `get_current_user_optional` | Returns user ID if JWT is valid, `None` otherwise (used for guest-compatible routes) |
| `get_admin_user` | Requires a valid JWT with `role: admin`; raises 403 otherwise |

All admin endpoints additionally call `_verify_admin_db()`, which reads `is_admin` from the database before proceeding. This provides a second check independent of the JWT claim — an account can be revoked in the database without waiting for the token to expire.

Non-admin users cannot access any `/api/admin/*` endpoint.

---

## CORS

CORS is configured with `fastapi.middleware.cors.CORSMiddleware`. The allowed origins are controlled by the `ALLOWED_ORIGINS` environment variable:

- In production: `https://ai.shahidur.me`
- In development: typically `http://localhost:3000`

A regex rule also allows any `localhost` or `127.0.0.1` origin during development. In production, this regex still permits localhost origins — relevant only to developers testing against the live backend directly.

---

## Database Security

- The `DATABASE_URL` contains the Neon PostgreSQL credentials. It is read from the environment at startup and never logged in plain form.
- The backend scrubs exception messages that may contain the DSN string before logging.
- All database connections use TLS (`sslmode=require` in the connection string).
- No database port is opened on the VPS. The database is the external Neon service, accessible only with valid credentials.

---

## Production Security Checklist

- [ ] `JWT_SECRET` is a strong, randomly generated value (not a default or short string)
- [ ] Real secrets exist only in the VPS environment (`.env` on the server)
- [ ] `.env` is listed in `.gitignore` and has never been committed
- [ ] Ollama container has no published ports and is not reachable from the internet
- [ ] Neon database is not directly exposed — accessed only via authenticated TLS connection string
- [ ] HTTPS is enabled via Caddy with automatic TLS certificate management
- [ ] `ALLOWED_ORIGINS` is restricted to the deployed frontend origin in production
- [ ] FastAPI port is bound to `127.0.0.1` — not reachable externally without Caddy
- [ ] SSH access to the VPS is secured (key-based authentication recommended)
- [ ] Docker containers are running as non-root where possible (review if hardening is needed)
- [ ] Admin accounts use strong passwords stored as bcrypt hashes
