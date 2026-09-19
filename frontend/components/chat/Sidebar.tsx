"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { fetchChats, searchChats, deleteChat as apiDeleteChat, renameChat as apiRenameChat } from "@/lib/api";

interface ChatMeta {
  id: number;
  title: string;
  created_at: string;
}

interface SidebarProps {
  currentChatId: number | null;
  onSelectChat: (id: number) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onToggle: () => void;
  token: string | null;
  refreshKey: number;
}

export default function Sidebar({
  currentChatId,
  onSelectChat,
  onNewChat,
  isOpen,
  onToggle,
  token,
  refreshKey,
}: SidebarProps) {
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeOptionsId, setActiveOptionsId] = useState<number | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    if (token) loadChats();
  }, [token, refreshKey]);

  const loadChats = async () => {
    setLoading(true);
    try {
      const data = await fetchChats();
      setChats(data);
      if (!searchQuery) setFilteredChats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      if (!query.trim()) {
        setFilteredChats(chats);
        return;
      }

      searchTimerRef.current = setTimeout(async () => {
        try {
          const results = await searchChats(query);
          setFilteredChats(results);
        } catch {
          // Fallback to client-side filter
          const lower = query.toLowerCase();
          setFilteredChats(chats.filter((c) => c.title.toLowerCase().includes(lower)));
        }
      }, 300);
    },
    [chats]
  );

  const handleDeleteChat = async (e: React.MouseEvent, chatId: number) => {
    e.stopPropagation();
    if (deletingId) return;
    setDeletingId(chatId);
    try {
      await apiDeleteChat(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      setFilteredChats((prev) => prev.filter((c) => c.id !== chatId));
      if (currentChatId === chatId) onNewChat();
    } catch (e) {
      console.error("Failed to delete chat", e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartRename = (e: React.MouseEvent, chat: ChatMeta) => {
    e.stopPropagation();
    setRenamingId(chat.id);
    setRenameValue(chat.title);
  };

  const handleSaveRename = async (chatId: number) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await apiRenameChat(chatId, renameValue);
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title: renameValue } : c)));
      setFilteredChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title: renameValue } : c)));
    } catch (e) {
      console.error("Failed to rename chat", e);
    } finally {
      setRenamingId(null);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, chatId: number) => {
    if (e.key === "Enter") {
      handleSaveRename(chatId);
    } else if (e.key === "Escape") {
      setRenamingId(null);
    }
  };

  const handleTouchStart = (chatId: number) => {
    isLongPress.current = false;
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      isLongPress.current = true;
      setActiveOptionsId(chatId);
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  const handleTouchMove = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  // Close options when clicking elsewhere
  useEffect(() => {
    const handleClick = () => {
      if (activeOptionsId !== null && !isLongPress.current) {
        setActiveOptionsId(null);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [activeOptionsId]);

  const maxChats = 100;
  const isAtLimit = chats.length >= maxChats;
  const displayChats = searchQuery ? filteredChats : chats;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm sidebar-backdrop"
          onClick={onToggle}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`
          sidebar-panel
          ${isOpen ? "sidebar-open" : "sidebar-closed"}
        `}
      >
        {/* Header */}
        <div className="p-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <h2 className="font-semibold text-white text-sm">Chat History</h2>
          <button
            onClick={onToggle}
            className="text-violet-300/50 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            title="Close sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* New Chat + Search */}
        <div className="p-3 space-y-2 flex-shrink-0">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onToggle();
            }}
            disabled={isAtLimit}
            className="w-full py-2 px-3 bg-violet-600/20 border border-violet-500/30 rounded-xl text-sm font-medium text-white hover:bg-violet-600/30 shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Chat
          </button>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-violet-300/30"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-white/5 border border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-violet-300/30 focus:outline-none focus:border-violet-500/30 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-violet-300/40 hover:text-white"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-semibold text-violet-300/40 uppercase tracking-wider">
              {searchQuery ? "Results" : "Recent"}
            </span>
            <span className={`text-[10px] font-medium ${isAtLimit ? "text-red-400" : "text-violet-300/30"}`}>
              {chats.length} / {maxChats}
            </span>
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 no-scrollbar">
          {loading && chats.length === 0 ? (
            <div className="text-center text-xs text-violet-300/40 py-8">Loading...</div>
          ) : displayChats.length === 0 ? (
            <div className="text-center text-xs text-violet-300/40 py-8">
              {searchQuery ? "No matches found" : "No chats yet"}
            </div>
          ) : (
            displayChats.map((chat) => (
              <div
                key={chat.id}
                className={`group relative flex items-center rounded-lg transition-colors ${
                  currentChatId === chat.id
                    ? "bg-violet-600/20 border border-violet-500/30"
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                {renamingId === chat.id ? (
                  <div className="flex-1 px-3 py-1.5 flex items-center">
                    <input
                      type="text"
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyDown(e, chat.id)}
                      onBlur={() => handleSaveRename(chat.id)}
                      className="w-full bg-white/10 border border-violet-500/50 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      if (isLongPress.current) {
                        e.preventDefault();
                        e.stopPropagation();
                        isLongPress.current = false;
                        return;
                      }
                      onSelectChat(chat.id);
                      if (window.innerWidth < 768) onToggle();
                    }}
                    onTouchStart={() => handleTouchStart(chat.id)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onContextMenu={(e) => {
                      if (window.innerWidth < 768) e.preventDefault();
                    }}
                    className="flex-1 text-left px-3 py-2 text-sm truncate select-none"
                  >
                    <span className={`block truncate ${
                      currentChatId === chat.id
                        ? "text-violet-100 font-medium"
                        : "text-violet-200/80"
                    }`}>
                      {chat.title}
                    </span>
                  </button>
                )}

                <div className={`flex items-center flex-shrink-0 transition-opacity ${
                  renamingId === chat.id ? "hidden" : activeOptionsId === chat.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}>
                  {/* Edit button */}
                  <button
                    onClick={(e) => handleStartRename(e, chat)}
                    className="p-1.5 rounded-md hover:bg-white/10 text-violet-300/40 hover:text-white transition-colors"
                    title="Rename chat"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                    className={`mr-1.5 p-1.5 rounded-md transition-colors ${
                      deletingId === chat.id
                        ? "opacity-50"
                        : "hover:bg-red-500/20 hover:text-red-400 text-violet-300/40"
                    }`}
                    title="Delete chat"
                    disabled={deletingId === chat.id}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 text-[10px] text-violet-300/30 text-center uppercase tracking-widest flex-shrink-0">
          Powered by Neon Serverless
        </div>
      </div>
    </>
  );
}
