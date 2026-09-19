"use client";

import { useEffect, useRef, useState, UIEvent } from "react";
import { Message } from "@/lib/types";
import MessageBubble from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  isThinking: boolean;
}

export default function MessageList({
  messages,
  isThinking,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScrollEnabled = useRef(true);
  const prevMsgCount = useRef(messages.length);

  useEffect(() => {
    // Re-enable auto-scroll when a new message is added (e.g. user sends a message)
    if (messages.length > prevMsgCount.current) {
      autoScrollEnabled.current = true;
    }
    prevMsgCount.current = messages.length;

    if (autoScrollEnabled.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, isThinking]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    // If they hit the absolute bottom, lock auto-scroll back on
    if (scrollHeight - scrollTop - clientHeight < 50) {
      autoScrollEnabled.current = true;
    }
  };

  const handleManualInteraction = () => {
    // User is manually interacting (wheel or swipe). Disable auto-scroll temporarily.
    autoScrollEnabled.current = false;
  };

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-6 no-scrollbar"
      onScroll={handleScroll}
      onWheel={handleManualInteraction}
      onTouchMove={handleManualInteraction}
      role="log"
      aria-live="polite"
      aria-label="Conversation"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1;
          const isThinkingMsg =
            isLast &&
            isThinking &&
            msg.role === "assistant";

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isThinking={isThinkingMsg}
            />
          );
        })}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </div>
  );
}
