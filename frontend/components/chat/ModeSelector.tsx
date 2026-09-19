"use client";

import { Mode } from "@/lib/types";

interface ModeSelectorProps {
  mode: Mode;
  onChange: (m: Mode) => void;
  disabled?: boolean;
}

export default function ModeSelector({ mode, onChange, disabled }: ModeSelectorProps) {
  const modes: { id: Mode; label: string }[] = [
    { id: "friendly", label: "Friendly" },
    { id: "casual", label: "Casual" },
    { id: "study", label: "Study" },
  ];

  return (
    <div className="flex bg-white/5 p-1 rounded-full border border-violet-500/20 backdrop-blur-md">
      {modes.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            disabled={disabled}
            onClick={() => onChange(m.id)}
            className={`
              relative px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300
              ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-white"}
              ${active ? "text-white" : "text-violet-300/70"}
            `}
          >
            {active && (
              <div
                className="absolute inset-0 bg-violet-600 rounded-full shadow-[0_0_10px_rgba(124,58,237,0.4)]"
                style={{ zIndex: 0 }}
              />
            )}
            <span className="relative z-10">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
