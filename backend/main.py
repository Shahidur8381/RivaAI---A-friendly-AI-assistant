import os
import json
import time
import logging
from contextlib import asynccontextmanager
from typing import Literal, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import timedelta

import asyncpg
from database import get_db_pool
from auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_user_optional,
    get_admin_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

# ============================================================
# Configuration
# ============================================================

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "30m")
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "2048"))
OLLAMA_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "-1"))
OLLAMA_TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", "0.7"))

# ============================================================
# Logging
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("riva")

# ============================================================
# System prompts
# ============================================================

SYSTEM_PROMPTS = {
    "friendly": "You are Riva, a friendly friend. Give short answers and always end by asking a friendly follow-up question (e.g., if they want to know more about this/that). Keep it conversational and warm.",
    "casual": "You are Riva, a casual chat buddy. Give the absolute shortest possible answers. Use plenty of emojis. Keep the conversation flowing casually by asking if they want to know about related topics.",
    "study": "You are Riva, a patient study assistant. Explain the concept clearly and step-by-step. At the end of your explanation, you MUST provide a quick test consisting of 2-5 questions to check if the user understood the topic (formatted as a bulleted list). Finally, end with a follow-up question asking if they understand the concept and are ready to move on to related topics.",
}

# ============================================================
# Shared state
# ============================================================

_ollama_client: httpx.AsyncClient | None = None
_db_pool: asyncpg.Pool | None = None
_active_tasks = set()

OLLAMA_TIMEOUT = httpx.Timeout(connect=5.0, read=300.0, write=10.0, pool=5.0)


# ============================================================
# Helpers
# ============================================================

def get_db() -> asyncpg.Pool:
    if _db_pool is None:
        raise HTTPException(status_code=503, detail="Database service is starting or unavailable")
    return _db_pool


async def is_maintenance_on() -> bool:
    """Check maintenance mode from DB settings table."""
    if _db_pool is None:
        return False
    try:
        async with get_db().acquire() as conn:
            val = await conn.fetchval("SELECT value FROM settings WHERE key = 'maintenance_mode'")
            return val == "true"
    except Exception:
        return False


def _build_ollama_payload(messages: list, mode: str = "friendly") -> dict:
    return {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": True,
        "keep_alive": OLLAMA_KEEP_ALIVE,
        "options": {
            "num_ctx": OLLAMA_NUM_CTX,
            "num_predict": OLLAMA_NUM_PREDICT,
            "temperature": OLLAMA_TEMPERATURE,
        },
    }


async def _stream_ollama(payload: dict):
    """Shared streaming generator for both guest and authenticated chat."""
    try:
        async with _ollama_client.stream("POST", "/api/chat", json=payload) as response:
            if response.status_code != 200:
                body = await response.aread()
                log.error("Ollama HTTP %s: %s", response.status_code, body[:300])
                yield f"data: {json.dumps('Riva is unavailable right now.')}\n\n"
                yield "data: [DONE]\n\n"
                return

            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if data.get("done"):
                    yield "data: [DONE]\n\n"
                    return

                content = data.get("message", {}).get("content", "")
                if content:
                    yield f"data: {json.dumps(content)}\n\n"

    except httpx.TimeoutException:
        yield f"data: {json.dumps('Riva timed out. Please try again.')}\n\n"
        yield "data: [DONE]\n\n"
    except httpx.ConnectError:
        yield f"data: {json.dumps('Riva cannot reach her AI engine.')}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as exc:
        log.exception("Streaming error: %s", exc)
        yield f"data: {json.dumps('Something went wrong.')}\n\n"
        yield "data: [DONE]\n\n"


def _sse_response(generator):
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ============================================================
# Lifespan
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _ollama_client, _db_pool

    _ollama_client = httpx.AsyncClient(
        base_url=OLLAMA_BASE_URL,
        timeout=OLLAMA_TIMEOUT,
        limits=httpx.Limits(max_keepalive_connections=5, max_connections=10, keepalive_expiry=120.0),
        http2=False,
    )
    log.info("✓ Ollama client ready → %s", OLLAMA_BASE_URL)

    _db_pool = await get_db_pool()
    app.state.db_pool = _db_pool
    log.info("✓ Database pool ready")

    # Initialize database schema if needed
    try:
        from database import init_db
        await init_db()
    except Exception as exc:
        log.warning("⚠ DB schema check warning: %s", exc)

    # Warm up model
    try:
        t = time.perf_counter()
        r = await _ollama_client.post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": [{"role": "user", "content": "Hi"}],
            "stream": False, "keep_alive": OLLAMA_KEEP_ALIVE,
            "options": {"num_ctx": OLLAMA_NUM_CTX, "num_predict": 1},
        })
        if r.status_code == 200:
            log.info("✓ Model warmed up: %s | %.2fs", OLLAMA_MODEL, time.perf_counter() - t)
    except Exception as exc:
        log.warning("⚠ Could not warm up Ollama: %s", exc)

    yield

    if _ollama_client:
        await _ollama_client.aclose()
    if _db_pool:
        await _db_pool.close()
    log.info("✓ Resources closed")


# ============================================================
# App
# ============================================================

app = FastAPI(title="Riva AI API", lifespan=lifespan)

ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001").split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Request models
# ============================================================

class SignupRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class ChatRequest(BaseModel):
    message: str
    mode: Literal["friendly", "casual", "study"] = "friendly"
    chat_id: int | None = None

class GuestChatRequest(BaseModel):
    message: str
    mode: Literal["friendly", "casual", "study"] = "friendly"

class CreateChatRequest(BaseModel):
    message: str

class MaintenanceRequest(BaseModel):
    enabled: bool

class RenameChatRequest(BaseModel):
    title: str


# ============================================================
# Health
# ============================================================

@app.get("/api/health")
async def health():
    maintenance = await is_maintenance_on()
    if _ollama_client is None:
        return {"status": "starting", "model": OLLAMA_MODEL, "maintenance": maintenance}
    try:
        r = await _ollama_client.get("/api/tags")
        ollama_ok = r.status_code == 200
    except Exception:
        ollama_ok = False
    return {
        "status": "ok" if ollama_ok else "degraded",
        "model": OLLAMA_MODEL,
        "ollama": ollama_ok,
        "maintenance": maintenance,
    }


# ============================================================
# Auth
# ============================================================

@app.post("/api/auth/signup")
async def signup(req: SignupRequest):
    if not req.username.strip() or not req.password.strip():
        raise HTTPException(status_code=400, detail="Username and password required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    hashed = get_password_hash(req.password)
    async with get_db().acquire() as conn:
        try:
            await conn.execute(
                "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
                req.username.strip(), hashed,
            )
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=400, detail="Username already exists")
    return {"status": "success"}


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    async with get_db().acquire() as conn:
        user = await conn.fetchrow(
            "SELECT id, password_hash, is_admin, disabled FROM users WHERE username = $1",
            req.username,
        )
        if not user or not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")
        if user["disabled"]:
            raise HTTPException(status_code=403, detail="Account is disabled")

        role = "admin" if user["is_admin"] else "user"
        access_token = create_access_token(
            data={"sub": str(user["id"]), "role": role},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": role,
            "username": req.username,
        }


@app.get("/api/auth/me")
async def get_me(user_id: int = Depends(get_current_user)):
    async with get_db().acquire() as conn:
        user = await conn.fetchrow(
            "SELECT id, username, is_admin, created_at FROM users WHERE id = $1", user_id
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "id": user["id"],
            "username": user["username"],
            "role": "admin" if user["is_admin"] else "user",
            "created_at": user["created_at"],
        }


# ============================================================
# Guest Chat — NO auth, NO database writes
# ============================================================

@app.post("/api/chat/guest")
async def guest_chat(request: GuestChatRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if _ollama_client is None:
        raise HTTPException(status_code=503, detail="AI service is starting")
    if await is_maintenance_on():
        raise HTTPException(status_code=503, detail="Riva is currently in maintenance mode")

    payload = _build_ollama_payload(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPTS[request.mode]},
            {"role": "user", "content": message},
        ],
        mode=request.mode,
    )
    return _sse_response(_stream_ollama(payload))


# ============================================================
# Authenticated Chat (with history)
# ============================================================

@app.get("/api/chats")
async def get_chats(user_id: int = Depends(get_current_user)):
    async with get_db().acquire() as conn:
        chats = await conn.fetch(
            "SELECT id, title, created_at FROM chats WHERE user_id = $1 ORDER BY created_at DESC", user_id
        )
        return [{"id": c["id"], "title": c["title"], "created_at": c["created_at"]} for c in chats]


@app.get("/api/chats/search")
async def search_chats(q: str = "", user_id: int = Depends(get_current_user)):
    query = q.strip()
    if not query:
        return []
    async with get_db().acquire() as conn:
        chats = await conn.fetch(
            "SELECT id, title, created_at FROM chats WHERE user_id = $1 AND title ILIKE $2 ORDER BY created_at DESC LIMIT 20",
            user_id, f"%{query}%",
        )
        return [{"id": c["id"], "title": c["title"], "created_at": c["created_at"]} for c in chats]


@app.get("/api/chats/{chat_id}")
async def get_chat(chat_id: int, user_id: int = Depends(get_current_user)):
    async with get_db().acquire() as conn:
        chat = await conn.fetchrow("SELECT id FROM chats WHERE id = $1 AND user_id = $2", chat_id, user_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        msgs = await conn.fetch(
            "SELECT id, role, content, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at ASC",
            chat_id,
        )
        return [{"id": m["id"], "role": m["role"], "content": m["content"], "created_at": m["created_at"]} for m in msgs]


@app.post("/api/chats")
async def create_chat(req: CreateChatRequest, user_id: int = Depends(get_current_user)):
    title = req.message[:50]
    async with get_db().acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM chats WHERE user_id = $1", user_id)
        if count >= 100:
            raise HTTPException(status_code=400, detail="Chat limit reached (100). Please delete older chats.")
        chat_id = await conn.fetchval(
            "INSERT INTO chats (user_id, title) VALUES ($1, $2) RETURNING id", user_id, title
        )
        return {"id": chat_id, "title": title}


@app.delete("/api/chats/{chat_id}")
async def delete_chat(chat_id: int, user_id: int = Depends(get_current_user)):
    async with get_db().acquire() as conn:
        res = await conn.execute("DELETE FROM chats WHERE id = $1 AND user_id = $2", chat_id, user_id)
        if res == "DELETE 0":
            raise HTTPException(status_code=404, detail="Chat not found")
        return {"status": "success"}


@app.patch("/api/chats/{chat_id}")
async def rename_chat(chat_id: int, req: RenameChatRequest, user_id: int = Depends(get_current_user)):
    title = req.title.strip()[:100]
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    async with get_db().acquire() as conn:
        res = await conn.execute(
            "UPDATE chats SET title = $1 WHERE id = $2 AND user_id = $3",
            title, chat_id, user_id,
        )
        if res == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Chat not found")
    return {"status": "success", "title": title}


@app.post("/api/chats/{chat_id}/generate-title")
async def generate_chat_title(chat_id: int, user_id: int = Depends(get_current_user)):
    """Use the AI to generate a short title from the first few messages."""
    if _ollama_client is None:
        raise HTTPException(status_code=503, detail="AI service is starting")
    async with get_db().acquire() as conn:
        chat = await conn.fetchrow("SELECT id FROM chats WHERE id = $1 AND user_id = $2", chat_id, user_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        msgs = await conn.fetch(
            "SELECT role, content FROM messages WHERE chat_id = $1 ORDER BY created_at ASC LIMIT 4",
            chat_id,
        )
        if not msgs:
            return {"title": "New Chat"}

    # Build a summary prompt
    conversation = "\n".join(f"{m['role']}: {m['content'][:200]}" for m in msgs)
    prompt_msgs = [
        {"role": "system", "content": "Generate a short title (3-6 words) for this conversation. Reply with ONLY the title, no quotes, no explanation."},
        {"role": "user", "content": conversation},
    ]

    try:
        r = await _ollama_client.post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": prompt_msgs,
            "stream": False,
            "keep_alive": OLLAMA_KEEP_ALIVE,
            "options": {"num_ctx": 512, "num_predict": 20, "temperature": 0.3},
        }, timeout=15.0)
        if r.status_code == 200:
            data = r.json()
            title = data.get("message", {}).get("content", "").strip().strip('"').strip("'")[:100]
            if title:
                async with get_db().acquire() as conn:
                    await conn.execute(
                        "UPDATE chats SET title = $1 WHERE id = $2 AND user_id = $3",
                        title, chat_id, user_id,
                    )
                return {"title": title}
    except Exception as exc:
        log.warning("Title generation failed: %s", exc)

    # Fallback: use first message content
    fallback = msgs[0]["content"][:50] if msgs else "New Chat"
    return {"title": fallback}


@app.post("/api/chat")
async def chat(request: ChatRequest, user_id: int = Depends(get_current_user)):
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if not request.chat_id:
        raise HTTPException(status_code=400, detail="chat_id is required")
    if _ollama_client is None:
        raise HTTPException(status_code=503, detail="AI service is starting")
    if await is_maintenance_on():
        raise HTTPException(status_code=503, detail="Riva is currently in maintenance mode")

    async with get_db().acquire() as conn:
        chat = await conn.fetchrow("SELECT id FROM chats WHERE id = $1 AND user_id = $2", request.chat_id, user_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        await conn.execute("INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3)", request.chat_id, "user", message)
        db_msgs = await conn.fetch(
            """
            SELECT role, content FROM (
                SELECT role, content, created_at FROM messages 
                WHERE chat_id = $1 
                ORDER BY created_at DESC 
                LIMIT 5
            ) sub ORDER BY created_at ASC
            """,
            request.chat_id,
        )
        ollama_msgs = [{"role": "system", "content": SYSTEM_PROMPTS[request.mode]}]
        for m in db_msgs:
            ollama_msgs.append({"role": m["role"], "content": m["content"]})

    payload = _build_ollama_payload(ollama_msgs, request.mode)

    import asyncio
    queue = asyncio.Queue()

    async def background_task():
        full_response = []
        try:
            async for chunk in _stream_ollama(payload):
                await queue.put(chunk)
                if chunk == "data: [DONE]\n\n":
                    break
                
                line = chunk.strip()
                if line.startswith("data: "):
                    raw = line[6:]
                    try:
                        text = json.loads(raw)
                        if isinstance(text, str):
                            full_response.append(text)
                    except (json.JSONDecodeError, TypeError):
                        pass
        except Exception as exc:
            log.exception("Background task error: %s", exc)
            await queue.put(f"data: {{json.dumps('Something went wrong.')}}\n\n")
            await queue.put("data: [DONE]\n\n")
        finally:
            final = "".join(full_response)
            if final:
                try:
                    async with get_db().acquire() as conn:
                        await conn.execute(
                            "INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3)",
                            request.chat_id, "assistant", final,
                        )
                    log.info(f"Background task successfully saved response for chat {request.chat_id}")
                except Exception as e:
                    log.error("Failed to save background message: %s", e)

    # Start the background task independently and keep a strong reference
    task = asyncio.create_task(background_task())
    _active_tasks.add(task)
    task.add_done_callback(_active_tasks.discard)

    async def generate():
        try:
            while True:
                chunk = await queue.get()
                yield chunk
                if chunk == "data: [DONE]\n\n":
                    break
        except asyncio.CancelledError:
            log.info("Client disconnected, Riva is finishing generation in the background.")
            raise

    return _sse_response(generate())


# ============================================================
# Admin Endpoints (all protected server-side)
# ============================================================

async def _verify_admin_db(user_id: int):
    """Double-check admin status in database (defense in depth)."""
    async with get_db().acquire() as conn:
        is_admin = await conn.fetchval("SELECT is_admin FROM users WHERE id = $1", user_id)
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")


@app.get("/api/admin/stats")
async def admin_stats(user_id: int = Depends(get_admin_user)):
    await _verify_admin_db(user_id)
    async with get_db().acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM users")
        active = await conn.fetchval("SELECT COUNT(*) FROM users WHERE disabled = FALSE")
        return {"total_users": total, "active_users": active, "registered_users": total}


@app.get("/api/admin/users")
async def admin_users(user_id: int = Depends(get_admin_user)):
    await _verify_admin_db(user_id)
    async with get_db().acquire() as conn:
        users = await conn.fetch(
            "SELECT id, username, is_admin, disabled, created_at FROM users ORDER BY created_at DESC"
        )
        return [
            {
                "id": u["id"], "username": u["username"],
                "is_admin": u["is_admin"], "disabled": u["disabled"],
                "created_at": u["created_at"],
            }
            for u in users
        ]


@app.post("/api/admin/users/{uid}/disable")
async def admin_disable_user(uid: int, user_id: int = Depends(get_admin_user)):
    await _verify_admin_db(user_id)
    if uid == user_id:
        raise HTTPException(status_code=400, detail="Cannot disable yourself")
    async with get_db().acquire() as conn:
        await conn.execute("UPDATE users SET disabled = TRUE WHERE id = $1", uid)
    return {"status": "success"}


@app.post("/api/admin/users/{uid}/enable")
async def admin_enable_user(uid: int, user_id: int = Depends(get_admin_user)):
    await _verify_admin_db(user_id)
    async with get_db().acquire() as conn:
        await conn.execute("UPDATE users SET disabled = FALSE WHERE id = $1", uid)
    return {"status": "success"}


@app.delete("/api/admin/users/{uid}")
async def admin_delete_user(uid: int, user_id: int = Depends(get_admin_user)):
    await _verify_admin_db(user_id)
    if uid == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    async with get_db().acquire() as conn:
        res = await conn.execute("DELETE FROM users WHERE id = $1", uid)
        if res == "DELETE 0":
            raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success"}


@app.get("/api/admin/maintenance")
async def admin_get_maintenance(user_id: int = Depends(get_admin_user)):
    await _verify_admin_db(user_id)
    enabled = await is_maintenance_on()
    return {"maintenance": enabled}


@app.post("/api/admin/maintenance")
async def admin_set_maintenance(req: MaintenanceRequest, user_id: int = Depends(get_admin_user)):
    await _verify_admin_db(user_id)
    async with get_db().acquire() as conn:
        await conn.execute(
            "UPDATE settings SET value = $1 WHERE key = 'maintenance_mode'",
            "true" if req.enabled else "false",
        )
    log.info("Maintenance mode %s by user %s", "ENABLED" if req.enabled else "DISABLED", user_id)
    return {"maintenance": req.enabled}
