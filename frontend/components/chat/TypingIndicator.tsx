"use client";

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1 text-violet-300/80 text-[0.9375rem] font-medium italic animate-pulse" aria-label="Riva is thinking" role="status">
      Riva is Thinking...
    </div>
  );
}
