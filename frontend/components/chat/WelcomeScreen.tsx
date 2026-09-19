"use client";

import RivaAvatar from "./RivaAvatar";

const SUGGESTIONS = [
  { text: "Help me debug a React useEffect issue" },
  { text: "Explain quantum computing simply" },
  { text: "Write a polite email to a client" },
  { text: "What's the best way to learn Python?" },
];

export default function WelcomeScreen({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full px-4 sm:px-6 py-4 sm:py-8">
      <RivaAvatar size="md" animate />
      
      <h2 className="mt-4 text-xl sm:text-2xl font-bold text-white tracking-tight animate-fade-slide-up" style={{ animationDelay: "100ms" }}>
        Riva AI
      </h2>
      <p className="text-violet-300/80 text-sm sm:text-base text-center mt-2 mb-6 max-w-sm leading-relaxed animate-fade-slide-up" style={{ animationDelay: "200ms" }}>
        Come here whenever you need me.
        <br/>
        <span className="text-xs opacity-70">Ask me anything...</span>
      </p>

      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-3xl animate-fade-slide-up" style={{ animationDelay: "300ms" }}>
        {SUGGESTIONS.map((s, i) => (
          <button
            key={s.text}
            onClick={() => onSuggestion(s.text)}
            className="group flex items-center p-3 rounded-xl text-left transition-all duration-300
              hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-violet-500 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-violet-500/30 shadow-md"
          >
            <span className="text-sm text-violet-100/90 group-hover:text-white transition-colors leading-snug">
              {s.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
