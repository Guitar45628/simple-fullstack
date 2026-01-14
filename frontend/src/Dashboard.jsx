import React, { useState, useEffect } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SITES = [
  { name: 'Google', color: '#8884d8' },
  { name: 'Facebook', color: '#82ca9d' },
  { name: 'YouTube', color: '#ffc658' },
  { name: 'Amazon', color: '#ff7300' },
  { name: 'Twitter', color: '#0088FE' },
  { name: 'Instagram', color: '#00C49F' },
  { name: 'Netflix', color: '#FFBB28' },
  { name: 'LinkedIn', color: '#FF8042' },
  { name: 'Microsoft', color: '#a4de6c' },
  { name: 'Apple', color: '#d0ed57' },
];

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [currentPings, setCurrentPings] = useState({});

  // Simulate Ping Data
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      const newPoint = { time: timeStr };
      const newPings = {};

      SITES.forEach(site => {
        // Random ping between 20ms and 150ms, with occasional spikes
        const basePing = Math.floor(Math.random() * 60) + 20; 
        const spike = Math.random() > 0.9 ? Math.floor(Math.random() * 100) : 0;
        const totalPing = basePing + spike;
        
        newPoint[site.name] = totalPing;
        newPings[site.name] = totalPing;
      });

      setCurrentPings(newPings);
      setData(prevData => {
        const newData = [...prevData, newPoint];
        if (newData.length > 20) return newData.slice(newData.length - 20); // Keep last 20 points
        return newData;
      });

    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.post('/logout');
      navigate('/login');
    } catch (err) {
      console.error('Logout failed', err);
      // Still navigate even if API fails (could be session expiry)
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (ping) => {
    if (ping < 60) return 'text-emerald-400';
    if (ping < 120) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusDot = (ping) => {
    if (ping < 60) return 'bg-emerald-500';
    if (ping < 120) return 'bg-yellow-500';
    return 'bg-red-500';
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
                <span className="ml-3 font-bold text-xl text-white tracking-tight">NetMonitor</span>
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
              Live Latency Dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-400">Real-time ping simulation for top global services.</p>
          </div>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {SITES.map((site) => (
            <div key={site.name} className="bg-slate-900 rounded-xl p-4 border border-slate-800 shadow-lg hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-300">{site.name}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${getStatusDot(currentPings[site.name] || 0)}`}></span>
              </div>
              <div className="flex items-baseline">
                <span className={`text-2xl font-bold ${getStatusColor(currentPings[site.name] || 0)}`}>
                  {currentPings[site.name] || '-'}
                </span>
                <span className="ml-1 text-xs text-slate-500">ms</span>
              </div>
            </div>
          ))}
        </div>

        {/* Chart Section */}
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
          <h3 className="text-lg font-medium text-slate-200 mb-6">Latency History (Last 60s)</h3>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" tick={{fontSize: 12}} />
                <YAxis stroke="#94a3b8" tick={{fontSize: 12}} label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                
                {SITES.map((site) => (
                  <Line
                    key={site.name}
                    type="monotone"
                    dataKey={site.name}
                    stroke={site.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                    animationDuration={500}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </main>
    </div>
  );
}

export default Dashboard;