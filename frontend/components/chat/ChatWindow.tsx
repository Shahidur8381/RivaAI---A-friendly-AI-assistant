"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mode, Message } from "@/lib/types";
import { streamChat, streamGuestChat, createChat, fetchChatMessages, generateChatTitle } from "@/lib/api";
import WelcomeScreen from "./WelcomeScreen";
import MessageList from "./MessageList";
import ChatComposer from "./ChatComposer";
import ModeSelector from "./ModeSelector";
import Sidebar from "./Sidebar";

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("friendly");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  const [chatId, setChatId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [isFirstMessage, setIsFirstMessage] = useState(true);

  const abortController = useRef<AbortController | null>(null);

  // Initialize auth state + sidebar default
  useEffect(() => {
    const t = localStorage.getItem("riva_token");
    setToken(t);
    setIsGuest(!t);
    // Default sidebar open on desktop, closed on mobile
    if (t && window.innerWidth >= 768) {
      setIsSidebarOpen(true);
    }
    
    // Resume previous chat if exists
    if (t) {
      const lastChat = localStorage.getItem("riva_last_chat_id");
      if (lastChat) {
        const id = parseInt(lastChat, 10);
        setChatId(id);
        loadChatHistory(id);
      }
    }
  }, []);

  const loadChatHistory = async (id: number) => {
    try {
      const msgs = await fetchChatMessages(id);
      setMessages(msgs);
      // If chat already has messages, it's not the first message
      setIsFirstMessage(msgs.length === 0);
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
  };

  const triggerSidebarRefresh = useCallback(() => {
    setSidebarRefreshKey((prev) => prev + 1);
  }, []);

  const stopGeneration = () => {
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }
  };

  const handleSend = async (messageText?: string) => {
    const text = (messageText || input).trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    setIsThinking(true);

    const newUserMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, newUserMsg]);

    const assistantMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: "assistant", content: "", isStreaming: true },
    ]);

    abortController.current = new AbortController();

    try {
      if (isGuest) {
        // Guest Flow (no DB write)
        await streamGuestChat(
          text,
          mode,
          (chunk) => {
            setIsThinking(false);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m))
            );
          },
          () => {
            setIsThinking(false);
            setIsStreaming(false);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
            );
          },
          (err) => {
            setIsThinking(false);
            setIsStreaming(false);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: err, isError: true, isStreaming: false } : m))
            );
          },
          abortController.current.signal
        );
      } else {
        // Authenticated Flow (DB write)
        let currentChatId = chatId;
        let isNewChat = false;

        if (!currentChatId) {
          try {
            const res = await createChat(text);
            currentChatId = res.id;
            setChatId(currentChatId);
            localStorage.setItem("riva_last_chat_id", currentChatId!.toString());
            isNewChat = true;
            triggerSidebarRefresh();
          } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : "Failed to create chat limit reached.";
            setIsThinking(false);
            setIsStreaming(false);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: errorMessage, isError: true, isStreaming: false }
                  : m
              )
            );
            return;
          }
        }

        await streamChat(
          text,
          mode,
          currentChatId!,
          (chunk) => {
            setIsThinking(false);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m))
            );
          },
          () => {
            setIsThinking(false);
            setIsStreaming(false);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
            );
            // Generate AI title after the first AI response in a new chat
            if ((isNewChat || isFirstMessage) && currentChatId) {
              setIsFirstMessage(false);
              generateChatTitle(currentChatId)
                .then(() => triggerSidebarRefresh())
                .catch(() => {/* ignore title generation failures */});
            }
          },
          (err) => {
            setIsThinking(false);
            setIsStreaming(false);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: err, isError: true, isStreaming: false } : m))
            );
          },
          abortController.current.signal
        );
      }
    } catch (error) {
      console.error(error);
      setIsThinking(false);
      setIsStreaming(false);
    }
  };

  const handleNewChat = () => {
    stopGeneration();
    setChatId(null);
    setMessages([]);
    setIsFirstMessage(true);
    localStorage.removeItem("riva_last_chat_id");
  };

  const handleSelectChat = (id: number) => {
    stopGeneration();
    setChatId(id);
    localStorage.setItem("riva_last_chat_id", id.toString());
    loadChatHistory(id);
  };

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  return (
    <div className="flex-1 flex overflow-hidden w-full relative h-[calc(100vh-64px)]">

      {!isGuest && (
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={handleToggleSidebar}
          currentChatId={chatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          token={token}
          refreshKey={sidebarRefreshKey}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <header className="flex items-center justify-between p-4 flex-shrink-0 absolute top-0 left-0 right-0 z-20 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Sidebar toggle — visible on ALL screen sizes when logged in */}
            {!isGuest && (
              <button
                onClick={handleToggleSidebar}
                className={`text-violet-300 hover:text-white transition-colors bg-white/5 p-2 rounded-xl backdrop-blur-md border border-white/10 shadow-sm ${
                  isSidebarOpen ? "md:opacity-0 md:pointer-events-none" : ""
                }`}
                title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              </button>
            )}

            {isGuest && (
              <div className="bg-violet-500/20 text-violet-200 text-xs px-3 py-1.5 rounded-full border border-violet-500/30 backdrop-blur-md shadow-sm">
                Guest Mode
              </div>
            )}
          </div>

          <div>
            {/* The ModeSelector has been moved to ChatComposer */}
          </div>
        </header>

        <div className="flex-1 flex flex-col w-full mx-auto overflow-hidden relative">
          {messages.length === 0 ? (
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-center pb-4">
              <WelcomeScreen onSuggestion={(text) => handleSend(text)} />
            </div>
          ) : (
            <MessageList messages={messages} isThinking={isThinking} />
          )}
        </div>

        <div className="flex-shrink-0 w-full bg-gradient-to-t from-[#070511] via-[#070511]/90 to-transparent pt-4 pb-2 z-10 relative">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={() => handleSend()}
            onStop={stopGeneration}
            isStreaming={isStreaming}
            mode={mode}
            onModeChange={setMode}
          />
        </div>
      </div>
    </div>
  );
}
