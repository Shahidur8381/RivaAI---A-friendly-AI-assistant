"use client";

import { Message } from "@/lib/types";
import RivaAvatar from "./RivaAvatar";
import TypingIndicator from "./TypingIndicator";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Components } from "react-markdown";

interface MessageBubbleProps {
  message: Message;
  isThinking?: boolean;
}

const CodeBlock: Components["code"] = ({ className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || "");
  const isBlock = !!match;

  if (isBlock) {
    return (
      <SyntaxHighlighter
        style={oneDark}
        language={match[1]}
        PreTag="div"
        customStyle={{
          borderRadius: "10px",
          border: "1px solid rgba(139,92,246,0.2)",
          background: "#070511",
          margin: "0.75rem 0",
          fontSize: "0.875rem",
        }}
        codeTagProps={{ style: { fontFamily: "'Fira Code', monospace" } }}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    );
  }

  return (
    <code
      className="font-mono text-[0.85em] bg-violet-500/20 text-violet-200 px-1.5 py-0.5 rounded border border-violet-500/30"
      {...props}
    >
      {children}
    </code>
  );
};

export default function MessageBubble({ message, isThinking = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isEmpty = !message.content && !isThinking;

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-fade-slide-up px-1">
        <div
          className="max-w-[80%] sm:max-w-[70%] px-4 py-3 rounded-2xl rounded-tr-sm bg-white/10 border border-white/10"
        >
          <p className="text-white text-[0.9375rem] leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-5 animate-fade-slide-up px-1">
      <div className="flex-shrink-0 mt-0.5">
        <RivaAvatar size="sm" />
      </div>

      <div className="flex-1 min-w-0 px-4 py-3 rounded-2xl rounded-tl-sm bg-violet-900/20 border border-violet-500/20 shadow-lg backdrop-blur-sm">
        {isThinking && !message.content && <TypingIndicator />}

        {message.isError && (
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-sm" aria-live="polite">
              ⚠️ {message.content || "Something went wrong."}
            </span>
          </div>
        )}

        {!message.isError && message.content && (
          <div
            className={`riva-prose ${message.isStreaming ? "streaming-cursor" : ""}`}
            aria-live={message.isStreaming ? "polite" : undefined}
            aria-atomic={message.isStreaming ? "false" : undefined}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {isThinking && !isEmpty && message.isStreaming && (
          <span className="sr-only">Riva is still writing...</span>
        )}
      </div>
    </div>
  );
}
