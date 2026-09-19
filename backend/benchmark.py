"""
Riva AI — Benchmark Script
Measures direct Ollama vs FastAPI proxy timing.

Usage:
    python benchmark.py

Requires: httpx, asyncio
Install:  pip install httpx
"""
import asyncio
import json
import time
import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
FASTAPI_URL = "http://127.0.0.1:8000"
MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
TEST_MESSAGE = "What is recursion? Answer briefly."

# ─── Helpers ──────────────────────────────────────────────────────────────────

def fmt_ms(ns: int) -> str:
    return f"{ns / 1_000_000:.1f} ms"

def fmt_s(ns: int) -> str:
    return f"{ns / 1_000_000_000:.3f} s"

# ─── Direct Ollama benchmark ──────────────────────────────────────────────────

async def bench_ollama_direct(client):
    print("\n" + "="*60)
    print("BENCHMARK 1 — Direct Ollama")
    print("="*60)

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "You are Riva, a helpful assistant. Be concise."},
            {"role": "user", "content": TEST_MESSAGE},
        ],
        "stream": True,
        "keep_alive": "30m",
        "options": {
            "num_ctx": 2048,
            "num_predict": 256,
            "temperature": 0.7,
        },
    }

    wall_start = time.perf_counter()
    first_token_time = None
    total_content = ""

    async with client.stream(
        "POST",
        f"{OLLAMA_URL}/api/chat",
        json=payload,
        timeout=300.0,
    ) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if not line:
                continue
            data = json.loads(line)
            if data.get("done"):
                wall_end = time.perf_counter()

                # Ollama timing metadata
                td  = data.get("total_duration", 0)
                ld  = data.get("load_duration", 0)
                ped = data.get("prompt_eval_duration", 0)
                ed  = data.get("eval_duration", 0)
                pec = data.get("prompt_eval_count", 0)
                ec  = data.get("eval_count", 0)

                print(f"\n  Wall clock total  : {wall_end - wall_start:.3f} s")
                print(f"  First token       : {first_token_time:.3f} s" if first_token_time else "  First token       : N/A")
                print(f"  Content length    : {len(total_content)} chars / ~{ec} tokens")
                print(f"\n  --- Ollama internal timing ---")
                print(f"  total_duration    : {fmt_s(td)}")
                print(f"  load_duration     : {fmt_ms(ld)}")
                print(f"  prompt_eval_dur   : {fmt_ms(ped)}  ({pec} tokens)")
                print(f"  eval_duration     : {fmt_s(ed)}  ({ec} tokens)")
                if ed > 0 and ec > 0:
                    tps = ec / (ed / 1_000_000_000)
                    print(f"  tokens/sec        : {tps:.1f}")
                break

            content = data.get("message", {}).get("content", "")
            if content:
                if first_token_time is None:
                    first_token_time = time.perf_counter() - wall_start
                total_content += content

    return first_token_time

# ─── FastAPI proxy benchmark ──────────────────────────────────────────────────

async def bench_fastapi(client):
    print("\n" + "="*60)
    print("BENCHMARK 2 — FastAPI Proxy")
    print("="*60)

    payload = {"message": TEST_MESSAGE, "mode": "friendly"}

    wall_start = time.perf_counter()
    first_token_time = None
    total_content = ""

    async with client.stream(
        "POST",
        f"{FASTAPI_URL}/api/chat",
        json=payload,
        timeout=300.0,
    ) as resp:
        resp.raise_for_status()

        buffer = ""
        async for chunk in resp.aiter_bytes():
            buffer += chunk.decode("utf-8", errors="replace")
            lines = buffer.split("\n")
            buffer = lines.pop()

            for line in lines:
                line = line.strip()
                if not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if raw == "[DONE]":
                    wall_end = time.perf_counter()
                    print(f"\n  Wall clock total  : {wall_end - wall_start:.3f} s")
                    print(f"  First token       : {first_token_time:.3f} s" if first_token_time else "  First token       : N/A")
                    print(f"  Content length    : {len(total_content)} chars")
                    return first_token_time
                try:
                    text = json.loads(raw)
                    if text:
                        if first_token_time is None:
                            first_token_time = time.perf_counter() - wall_start
                        total_content += text
                except json.JSONDecodeError:
                    pass

    return first_token_time

# ─── Health check ─────────────────────────────────────────────────────────────

async def check_health(client):
    print("\n" + "="*60)
    print("HEALTH CHECK — FastAPI")
    print("="*60)
    try:
        r = await client.get(f"{FASTAPI_URL}/api/health", timeout=5.0)
        print(f"  Status : {r.status_code}")
        print(f"  Body   : {r.json()}")
        return r.status_code == 200
    except Exception as e:
        print(f"  ERROR  : {e}")
        return False

# ─── Main ────────────────────────────────────────────────────────────────────

async def main():
    import httpx
    async with httpx.AsyncClient() as client:
        healthy = await check_health(client)
        if not healthy:
            print("\n⚠  FastAPI is not running. Start it first: uvicorn main:app --reload")
            print("   Skipping FastAPI benchmark.\n")

        ollama_ttft = await bench_ollama_direct(client)

        if healthy:
            fastapi_ttft = await bench_fastapi(client)

            if ollama_ttft and fastapi_ttft:
                overhead = (fastapi_ttft - ollama_ttft) * 1000
                print("\n" + "="*60)
                print("OVERHEAD ANALYSIS")
                print("="*60)
                print(f"  Direct Ollama TTFT : {ollama_ttft*1000:.1f} ms")
                print(f"  FastAPI TTFT       : {fastapi_ttft*1000:.1f} ms")
                print(f"  FastAPI overhead   : {overhead:.1f} ms")
                if overhead < 50:
                    print("  → Overhead is minimal. Inference is the bottleneck.")
                elif overhead < 200:
                    print("  → Small overhead. HTTP client reuse will help.")
                else:
                    print("  → Significant overhead. Investigate further.")

        print("\n✓ Benchmark complete.\n")

if __name__ == "__main__":
    asyncio.run(main())
