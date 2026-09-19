"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiSignup, apiLogin } from "@/lib/api";
import SuccessTransition from "@/components/ui/SuccessTransition";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("riva_token");
    if (token) {
      router.replace("/chat");
    }
  }, [router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      await apiSignup(username, password);
      // Auto-login after signup
      const data = await apiLogin(username, password);
      localStorage.setItem("riva_token", data.access_token);
      window.dispatchEvent(new Event("riva_auth_change"));
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Signup failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
      <SuccessTransition show={success} onComplete={() => router.push("/chat")} />
      
      <div className="w-full max-w-md glass-medium rounded-3xl p-8 sm:p-10 shadow-2xl animate-fade-slide-up">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Riva AI" className="h-10 object-contain mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-violet-200/70 text-sm">Join Riva AI to save your chats</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {error && <div className="text-red-400 text-sm text-center p-3 bg-red-500/10 rounded-xl border border-red-500/20">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-violet-200/80 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              className="w-full bg-black/20 border border-violet-500/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all placeholder-violet-300/30"
              placeholder="Choose a username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-violet-200/80 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-black/20 border border-violet-500/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all placeholder-violet-300/30"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3 mt-6 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-all shadow-[0_4px_16px_rgba(124,58,237,0.3)] hover:shadow-[0_4px_24px_rgba(124,58,237,0.5)] disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div className="mt-8 text-center space-y-4">
          <div className="text-sm text-violet-200/60">
            Already have an account?{" "}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Sign in
            </Link>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
          <div>
            <Link href="/chat" className="text-sm text-violet-300/80 hover:text-white font-medium transition-colors">
              Continue as Guest →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
