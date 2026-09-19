"use client";

import { useEffect, useRef, useState } from "react";

import { Mode } from "@/lib/types";

interface ChatComposerProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  mode: Mode;
  onModeChange: (m: Mode) => void;
}

export default function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  mode,
  onModeChange,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check mobile device for keyboard behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsModeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (isMobile) {
        // On mobile, let Enter natively insert a new line
        return;
      }
      e.preventDefault();
      if (value.trim() && !isStreaming) {
        onSend();
      }
    }
  };

  const MODES = [
    { id: "friendly", label: "Friendly" },
    { id: "casual", label: "Casual" },
    { id: "study", label: "Study" },
  ];

  const currentMode = MODES.find((m) => m.id === mode) || MODES[0];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-3 pt-1">
      <div 
        className="glass-medium rounded-2xl p-1.5 sm:p-2 flex items-end gap-2 transition-all duration-300 shadow-lg focus-within:shadow-[0_0_20px_rgba(124,58,237,0.15)] focus-within:border-violet-500/30"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.mode-dropdown')) return;
          textareaRef.current?.focus();
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
          className="flex-1 min-w-0 max-h-[200px] min-h-[36px] w-full bg-transparent text-white placeholder-violet-300/40 resize-none py-1.5 px-2 sm:px-3 focus:outline-none focus:ring-0 !outline-none text-[0.9375rem] leading-relaxed no-scrollbar"
          style={{ 
            outline: "none", 
            boxShadow: "none",
            scrollbarWidth: "none",
          }}
        />

        {/* Custom Mode Dropdown */}
        <div className="flex-shrink-0 relative mode-dropdown mb-1" ref={dropdownRef}>
          <button
            onClick={() => setIsModeOpen(!isModeOpen)}
            className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg text-xs text-violet-200 px-2.5 py-1.5 hover:bg-white/10 transition-colors focus:outline-none disabled:opacity-50"
          >
            <span>{currentMode.label}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isModeOpen ? "rotate-180" : ""}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          
          {isModeOpen && (
            <div className="absolute bottom-[calc(100%+8px)] right-0 w-32 bg-[#0b0718]/95 backdrop-blur-xl border border-violet-500/20 rounded-xl shadow-xl overflow-hidden animate-fade-slide-up z-50">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onModeChange(m.id as Mode);
                    setIsModeOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    mode === m.id ? "bg-violet-600/30 text-white font-medium" : "text-violet-200/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center mb-0.5 mr-0.5">
          {isStreaming ? (
            <button
              onClick={(e) => { e.stopPropagation(); onStop(); }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all duration-200 active:scale-95"
              title="Stop generating"
            >
              <div className="w-3.5 h-3.5 rounded-sm bg-current" />
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onSend(); }}
              disabled={!value.trim()}
              className={`p-2 rounded-xl transition-all duration-300 flex items-center justify-center
                ${
                  value.trim()
                    ? "bg-violet-600 hover:bg-violet-500 text-white shadow-md hover:shadow-[0_0_15px_rgba(124,58,237,0.4)] active:scale-95"
                    : "bg-white/5 text-violet-300/30 cursor-not-allowed"
                }
              `}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={value.trim() ? "translate-x-0.5 -translate-y-0.5 transition-transform" : ""}
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="text-center mt-2 text-[10px] sm:text-xs text-violet-300/40 font-medium tracking-wide">
        Riva can make mistakes. Consider verifying important information.
      </div>
    </div>
  );
}
