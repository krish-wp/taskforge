import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-400',
  RUNNING: 'bg-cyan-100 text-cyan-700 border-cyan-400',
  COMPLETED: 'bg-green-100 text-green-700 border-green-400',
  FAILED: 'bg-red-100 text-red-700 border-red-400',
  RETRYING: 'bg-orange-100 text-orange-700 border-orange-400',
};

const CARD_COLORS = {
  PENDING: 'border-l-yellow-400 bg-yellow-50',
  RUNNING: 'border-l-cyan-400 bg-cyan-50',
  COMPLETED: 'border-l-green-400 bg-green-50',
  FAILED: 'border-l-red-400 bg-red-50',
};

const FILTERS = ['ALL', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED'];

export default function App() {
  const [stats, setStats] = useState({ PENDING: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0 });
  const [jobs, setJobs] = useState([]);
  const [connected, setConnected] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [allJobs, setAllJobs] = useState([]);
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Fetch initial data
  useEffect(() => {
    fetch('/api/v1/dashboard/stats')
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error);

    fetch('/api/v1/dashboard/recent')
      .then((res) => res.json())
      .then(setJobs)
      .catch(console.error);
  }, []);

  // Fetch all jobs when switching to Jobs view
  useEffect(() => {
    if (currentView === 'jobs') {
      fetch('/api/v1/jobs')
        .then((res) => res.json())
        .then(setAllJobs)
        .catch(console.error);
    }
  }, [currentView]);

  // Socket.io connection
  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('jobs:update', (updatedJobs) => {
      setJobs((prev) => {
        const map = new Map(prev.map((j) => [j.id, j]));
        updatedJobs.forEach((j) => map.set(j.id, j));
        return Array.from(map.values())
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          .slice(0, 50);
      });

      // Also update allJobs if on Jobs view
      if (currentView === 'jobs') {
        setAllJobs((prev) => {
          const map = new Map(prev.map((j) => [j.id, j]));
          updatedJobs.forEach((j) => map.set(j.id, j));
          return Array.from(map.values())
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        });
      }

      setStats((prev) => {
        const newStats = { PENDING: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0 };
        updatedJobs.forEach((j) => {
          if (newStats[j.status] !== undefined) newStats[j.status]++;
        });
        return { ...prev, ...newStats };
      });
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('jobs:update');
    };
  }, [currentView]);

  // Periodic stats refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/v1/dashboard/stats')
        .then((res) => res.json())
        .then(setStats)
        .catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredJobs = activeFilter === 'ALL'
    ? allJobs
    : allJobs.filter((j) => j.status === activeFilter);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white p-6">
        <h1 className="text-2xl font-bold mb-8 text-cyan-400">TaskForge</h1>
        <nav className="space-y-2">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`block w-full text-left px-4 py-2 rounded font-medium ${
              currentView === 'dashboard'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-gray-400 hover:bg-gray-800'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setCurrentView('jobs')}
            className={`block w-full text-left px-4 py-2 rounded font-medium ${
              currentView === 'jobs'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-gray-400 hover:bg-gray-800'
            }`}
          >
            Jobs
          </button>
        </nav>
        <div className="mt-8 pt-6 border-t border-gray-700">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-gray-400">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {currentView === 'dashboard' && (
          <>
            <h2 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h2>

            {/* Status Cards */}
            <div className="grid grid-cols-4 gap-6 mb-8">
              {Object.entries(stats).map(([status, count]) => (
                <div
                  key={status}
                  className={`p-6 rounded-lg border-l-4 bg-white shadow-sm ${CARD_COLORS[status] || ''}`}
                >
                  <p className="text-sm font-medium text-gray-500 mb-1">{status}</p>
                  <p className="text-3xl font-bold text-gray-800">{count}</p>
                </div>
              ))}
            </div>

            {/* Recent Jobs Table */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800">Recent Jobs</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">#{job.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-800">{job.type}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-700'}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{job.priority}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                        No jobs yet. Create a job from the backend to see it here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {currentView === 'jobs' && (
          <>
            <h2 className="text-3xl font-bold text-gray-800 mb-8">Jobs</h2>

            {/* Filter Buttons */}
            <div className="flex gap-2 mb-6">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    activeFilter === f
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Jobs Table */}
            <div className="bg-white rounded-lg shadow-sm">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">#{job.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-800">{job.type}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-700'}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-red-500 max-w-xs truncate">
                        {job.error || '-'}
                      </td>
                    </tr>
                  ))}
                  {filteredJobs.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                        No {activeFilter !== 'ALL' ? activeFilter.toLowerCase() : ''} jobs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
