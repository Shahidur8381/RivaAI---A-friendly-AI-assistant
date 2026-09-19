"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiGetMe } from "@/lib/api";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<"guest" | "user" | "admin">("guest");
  
  const checkAuth = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("riva_token") : null;
    if (!token) {
      setRole("guest");
      return;
    }
    
    apiGetMe()
      .then(user => setRole(user.role))
      .catch(() => {
        localStorage.removeItem("riva_token");
        window.dispatchEvent(new Event("riva_auth_change"));
        setRole("guest");
      });
  };

  useEffect(() => {
    checkAuth();

    window.addEventListener("storage", checkAuth);
    window.addEventListener("riva_auth_change", checkAuth);
    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("riva_auth_change", checkAuth);
    };
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("riva_token");
    window.dispatchEvent(new Event("riva_auth_change"));
    setRole("guest");
    router.push("/");
  };

  return (
    <nav className="w-full border-b border-white/5 bg-[#070511]/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="Riva AI" className="h-8 object-contain" />
        </Link>

        {/* Links */}
        <div className="flex items-center gap-6">
          <Link href="/chat" className="text-sm font-medium text-violet-200 hover:text-white transition-colors">
            Chat
          </Link>
          
          {role === "admin" && (
            <Link href="/admin" className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors">
              Dashboard
            </Link>
          )}

          {role === "guest" ? (
            <Link 
              href="/login" 
              className="text-sm font-medium px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all text-white"
            >
              Sign In
            </Link>
          ) : (
            <button 
              onClick={handleLogout}
              className="text-sm font-medium text-violet-300/60 hover:text-white transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

