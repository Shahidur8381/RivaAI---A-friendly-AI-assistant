"use client";

import { useState } from "react";

export default function AuthModal({ onLogin }: { onLogin: (token: string) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      if (isLogin) {
        onLogin(data.access_token);
      } else {
        // Auto-login after signup
        setIsLogin(true);
        setError("Account created! Please log in.");
        setPassword("");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-sm p-8 bg-white rounded-3xl shadow-xl border border-slate-200 animate-fade-slide-up">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {isLogin ? "Welcome back" : "Create an account"}
        </h2>
        <p className="text-slate-500 mb-6 text-sm">
          {isLogin ? "Log in to access your chat history." : "Sign up to start chatting with Riva."}
        </p>

        {error && (
          <div className={`p-3 mb-4 text-sm rounded-xl ${error.includes("created") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
              placeholder="riva_user"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Please wait..." : (isLogin ? "Log In" : "Sign Up")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            className="text-violet-600 font-medium hover:underline"
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
