"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  apiGetMe, 
  adminGetStats, 
  adminGetUsers, 
  adminGetMaintenance, 
  adminSetMaintenance,
  adminDisableUser,
  adminEnableUser,
  adminDeleteUser
} from "@/lib/api";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [stats, setStats] = useState({ total_users: 0, active_users: 0, registered_users: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState(false);
  const [acting, setActing] = useState<number | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const me = await apiGetMe();
      if (me.role !== "admin") {
        router.replace("/chat");
        return;
      }
      loadData();
    } catch {
      router.replace("/login");
    }
  };

  const loadData = async () => {
    try {
      const [s, u, m] = await Promise.all([
        adminGetStats(),
        adminGetUsers(),
        adminGetMaintenance()
      ]);
      setStats(s);
      setUsers(u);
      setMaintenance(m.maintenance);
    } catch (err: any) {
      setError("Failed to load admin data. Check console.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMaintenance = async () => {
    try {
      const res = await adminSetMaintenance(!maintenance);
      setMaintenance(res.maintenance);
    } catch (err) {
      alert("Failed to toggle maintenance mode.");
    }
  };

  const toggleUserStatus = async (uid: number, disabled: boolean) => {
    setActing(uid);
    try {
      if (disabled) await adminEnableUser(uid);
      else await adminDisableUser(uid);
      await loadData();
    } catch (err) {
      alert("Failed to update user.");
    } finally {
      setActing(null);
    }
  };

  const deleteUser = async (uid: number) => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setActing(uid);
    try {
      await adminDeleteUser(uid);
      await loadData();
    } catch (err) {
      alert("Failed to delete user.");
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-violet-300">Loading Dashboard...</div>;
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 animate-fade-in overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Riva Command Center</h1>
          <p className="text-violet-300/70 text-sm">System status and user management</p>
        </div>
        
        <div className="glass-medium px-5 py-3 rounded-2xl flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-violet-300/70 font-semibold uppercase tracking-wider mb-1">Riva AI Status</span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${maintenance ? "bg-amber-500 animate-pulse" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"}`} />
              <span className="text-sm font-medium text-white">{maintenance ? "Maintenance" : "Online"}</span>
            </div>
          </div>
          <button 
            onClick={toggleMaintenance}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              maintenance 
                ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30" 
                : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
            }`}
          >
            {maintenance ? "Set Online" : "Set Maintenance"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="glass p-6 rounded-3xl">
          <h3 className="text-violet-300/70 text-sm font-medium mb-2">Total Users</h3>
          <p className="text-4xl font-bold text-white">{stats.total_users}</p>
        </div>
        <div className="glass p-6 rounded-3xl">
          <h3 className="text-violet-300/70 text-sm font-medium mb-2">Active Users</h3>
          <p className="text-4xl font-bold text-white">{stats.active_users}</p>
        </div>
        <div className="glass p-6 rounded-3xl">
          <h3 className="text-violet-300/70 text-sm font-medium mb-2">System Load</h3>
          <p className="text-4xl font-bold text-emerald-400">Stable</p>
        </div>
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Registered Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/20 text-violet-300/60 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Joined</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{u.username}</div>
                    <div className="text-xs text-violet-300/50">ID: {u.id}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-violet-200/80">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      u.is_admin ? "bg-violet-600/20 text-violet-300 border border-violet-500/30" : "bg-white/5 text-violet-200/70 border border-white/10"
                    }`}>
                      {u.is_admin ? "Admin" : "User"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 w-fit ${
                      u.disabled ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.disabled ? "bg-red-500" : "bg-emerald-500"}`} />
                      {u.disabled ? "Disabled" : "Active"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!u.is_admin && (
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          disabled={acting === u.id}
                          onClick={() => toggleUserStatus(u.id, u.disabled)}
                          className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-violet-200 rounded-lg transition-colors border border-white/10"
                        >
                          {u.disabled ? "Enable" : "Disable"}
                        </button>
                        <button
                          disabled={acting === u.id}
                          onClick={() => deleteUser(u.id)}
                          className="text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
