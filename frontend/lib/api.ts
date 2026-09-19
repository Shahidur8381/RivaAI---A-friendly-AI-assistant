import { Mode, HealthResponse, Message } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("riva_token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ── Health ──
export async function healthCheck(): Promise<HealthResponse & { maintenance?: boolean }> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) throw new Error("Backend unavailable");
  return res.json();
}

// ── Auth ──
export async function apiSignup(username: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Signup failed");
  return data;
}

export async function apiLogin(username: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Login failed");
  return data as { access_token: string; role: string; username: string };
}

export async function apiGetMe() {
  const res = await fetch(`${API_URL}/api/auth/me`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

// ── Chat History ──
export async function fetchChats() {
  const res = await fetch(`${API_URL}/api/chats`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch chats");
  return res.json();
}

export async function searchChats(query: string) {
  const res = await fetch(`${API_URL}/api/chats/search?q=${encodeURIComponent(query)}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to search chats");
  return res.json();
}

export async function createChat(message: string) {
  const res = await fetch(`${API_URL}/api/chats`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to create chat");
  return data;
}

export async function fetchChatMessages(chatId: number): Promise<Message[]> {
  const res = await fetch(`${API_URL}/api/chats/${chatId}`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch messages");
  const data = await res.json();
  // Map DB integer IDs to string IDs for React key compatibility
  return data.map((m: { id: number; role: string; content: string; created_at?: string }) => ({
    id: String(m.id),
    role: m.role as Message["role"],
    content: m.content,
  }));
}

export async function deleteChat(chatId: number) {
  const res = await fetch(`${API_URL}/api/chats/${chatId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete chat");
  return res.json();
}

export async function renameChat(chatId: number, title: string) {
  const res = await fetch(`${API_URL}/api/chats/${chatId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to rename chat");
  return res.json();
}

export async function generateChatTitle(chatId: number) {
  const res = await fetch(`${API_URL}/api/chats/${chatId}/generate-title`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to generate title");
  return res.json() as Promise<{ title: string }>;
}

// ── Guest Streaming (NO auth, NO db) ──
export async function streamGuestChat(
  message: string,
  mode: Mode,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  return _streamSSE(
    `${API_URL}/api/chat/guest`,
    { message, mode },
    { "Content-Type": "application/json" },
    onChunk, onDone, onError, signal,
  );
}

// ── Authenticated Streaming ──
export async function streamChat(
  message: string,
  mode: Mode,
  chatId: number,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  return _streamSSE(
    `${API_URL}/api/chat`,
    { message, mode, chat_id: chatId },
    getHeaders(),
    onChunk, onDone, onError, signal,
  );
}

// ── Admin ──
export async function adminGetStats() {
  const res = await fetch(`${API_URL}/api/admin/stats`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Forbidden");
  return res.json();
}

export async function adminGetUsers() {
  const res = await fetch(`${API_URL}/api/admin/users`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Forbidden");
  return res.json();
}

export async function adminDisableUser(uid: number) {
  const res = await fetch(`${API_URL}/api/admin/users/${uid}/disable`, {
    method: "POST", headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export async function adminEnableUser(uid: number) {
  const res = await fetch(`${API_URL}/api/admin/users/${uid}/enable`, {
    method: "POST", headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export async function adminDeleteUser(uid: number) {
  const res = await fetch(`${API_URL}/api/admin/users/${uid}`, {
    method: "DELETE", headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export async function adminGetMaintenance() {
  const res = await fetch(`${API_URL}/api/admin/maintenance`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Forbidden");
  return res.json();
}

export async function adminSetMaintenance(enabled: boolean) {
  const res = await fetch(`${API_URL}/api/admin/maintenance`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

// ── Shared SSE parser ──
async function _streamSSE(
  url: string,
  body: object,
  headers: HeadersInit,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") { onDone(); return; }
    onError("Riva couldn't reach her brain right now. Please try again.");
    return;
  }

  if (!response.ok) {
    onError(`Riva encountered an error (${response.status}). Please try again.`);
    return;
  }
  if (!response.body) {
    onError("Riva received an empty response. Please try again.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const raw = trimmed.slice(5).trim();
        if (raw === "[DONE]") { onDone(); return; }
        try {
          const text = JSON.parse(raw) as string;
          if (text) onChunk(text);
        } catch { /* skip */ }
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") { onDone(); return; }
    onError("Riva's connection was interrupted. Please try again.");
  } finally {
    reader.releaseLock();
  }
  onDone();
}
