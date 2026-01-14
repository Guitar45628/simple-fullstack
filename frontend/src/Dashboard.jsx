import React, { useState, useEffect } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  // Fetch System Stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/system-stats');
        setStats(response.data);
        setError(null);
      } catch (err) {
        console.error("Full Error Object:", err);
        console.log("Response Status:", err.response?.status);

        // If Unauthorized (401) or Forbidden (403), redirect to login
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            console.log("Redirecting to login...");
            navigate('/login');
            // Fallback if navigate doesn't work immediately
            // window.location.href = '/login'; 
        } else {
            setError("Failed to connect to backend");
        }
      }
    };

    fetchStats(); // Initial fetch
    const interval = setInterval(fetchStats, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [navigate]);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.post('/logout');
      navigate('/login');
    } catch (err) {
      console.error('Logout failed', err);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
      {/* Navbar */}
      <nav className="bg-slate-900 shadow-sm border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg animate-pulse">
                  N
                </div>
                <span className="ml-3 font-bold text-xl text-white tracking-tight">SystemMonitor</span>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                disabled={loading}
                className="ml-4 px-4 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-red-400 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
              >
                {loading ? 'Logging out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl sm:truncate">
              Server Health
            </h2>
            <p className="mt-1 text-sm text-slate-400">Real-time resource monitoring from Backend & Database.</p>
          </div>
          {stats && (
            <div className="mt-4 flex md:mt-0 md:ml-4">
               <span className="text-xs text-slate-500 font-mono">Last updated: {new Date(stats.timestamp).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded relative" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}

        {/* Stats Grid */}
        {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Backend CPU */}
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-lg">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Backend CPU</h3>
            <div className="flex items-end justify-between">
                <span className="text-4xl font-bold text-white">{stats.backend.cpu_percent.toFixed(1)}%</span>
                <div className={`h-2 w-24 rounded-full bg-slate-700 overflow-hidden`}>
                    <div 
                        className={`h-full ${stats.backend.cpu_percent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(stats.backend.cpu_percent, 100)}%` }}
                    ></div>
                </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Goroutines: {stats.backend.goroutines}</p>
          </div>

          {/* Backend Memory */}
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-lg">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Backend Memory</h3>
             <div className="flex items-end justify-between">
                <span className="text-4xl font-bold text-white">{stats.backend.memory_used_mb} <span className="text-lg text-slate-500">MB</span></span>
                <span className="text-sm text-slate-400">{stats.backend.memory_percent.toFixed(1)}% Used</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5 mt-4">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${stats.backend.memory_percent}%` }}></div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Go Alloc: {stats.backend.go_alloc_mb} MB</p>
          </div>

          {/* Database Health */}
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-lg">
             <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Database (PostgreSQL)</h3>
             <div className="flex items-center mb-4">
                <div className={`h-3 w-3 rounded-full mr-2 ${stats.database.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-lg font-semibold text-white uppercase">{stats.database.status}</span>
             </div>
             {stats.database.status === 'connected' ? (
                 <div className="space-y-2">
                     <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Open Connections:</span>
                        <span className="text-white font-mono">{stats.database.open_connections}</span>
                     </div>
                     <div className="flex justify-between text-sm">
                        <span className="text-slate-400">In Use:</span>
                        <span className="text-white font-mono">{stats.database.in_use}</span>
                     </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Idle:</span>
                        <span className="text-white font-mono">{stats.database.idle}</span>
                     </div>
                 </div>
             ) : (
                 <p className="text-red-400 text-sm">{stats.database.error}</p>
             )}
          </div>

        </div>
        ) : (
            <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <p className="mt-2 text-slate-400">Loading system stats...</p>
            </div>
        )}

      </main>
    </div>
  );
}

export default Dashboard;