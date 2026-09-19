"use client";

import Link from "next/link";
import RivaAvatar from "@/components/chat/RivaAvatar";
import { useEffect, useState } from "react";
import { apiGetMe } from "@/lib/api";

export default function LandingPage() {
  const [role, setRole] = useState<"guest" | "user" | "admin">("guest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("riva_token") : null;
      if (!token) {
        setRole("guest");
        setLoading(false);
        return;
      }

      apiGetMe()
        .then((user) => {
          setRole(user.role);
        })
        .catch(() => {
          localStorage.removeItem("riva_token");
          setRole("guest");
        })
        .finally(() => {
          setLoading(false);
        });
    };

    checkAuth();
    window.addEventListener("riva_auth_change", checkAuth);
    return () => window.removeEventListener("riva_auth_change", checkAuth);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
      
      <div className="animate-float mb-8">
        <RivaAvatar size="xl" />
      </div>

      <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight animate-fade-slide-up" style={{ animationDelay: "200ms" }}>
        Meet Riva AI
      </h1>
      
      <p className="text-xl text-violet-200/80 mb-10 max-w-lg animate-fade-slide-up" style={{ animationDelay: "300ms" }}>
        Come here whenever you need me.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-slide-up w-full max-w-sm sm:max-w-none" style={{ animationDelay: "400ms" }}>
        <Link 
          href="/chat"
          className="w-full sm:w-auto px-8 py-3.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-full transition-all shadow-[0_4px_16px_rgba(124,58,237,0.4)] hover:shadow-[0_4px_24px_rgba(124,58,237,0.6)] hover:-translate-y-0.5 active:translate-y-0"
        >
          Start Chatting
        </Link>
        
        {!loading && role === "admin" && (
          <Link 
            href="/admin"
            className="w-full sm:w-auto px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-full transition-all backdrop-blur-sm hover:-translate-y-0.5 active:translate-y-0"
          >
            Dashboard
          </Link>
        )}

        {!loading && role === "guest" && (
          <Link 
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-full transition-all backdrop-blur-sm hover:-translate-y-0.5 active:translate-y-0"
          >
            Sign In
          </Link>
        )}
      </div>

    </div>
  );
}

