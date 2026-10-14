import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldAlert, Activity, Cctv, Users, Cpu, ArrowUpDown, 
  Wifi, Video, ChevronDown, KeyRound, UserPlus, LogOut, 
  HardDrive, ShieldCheck, Shield, Info 
} from 'lucide-react';
import LiveFeed from './components/LiveFeed';
import VisitorLogs from './components/VisitorLogs';
import SavedCameras from './components/SavedCameras';
import Auth from './components/Auth';
import { API_BASE_URL } from './config';

export default function App() {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'cameras' | 'logs'
  const [cameraStatus, setCameraStatus] = useState('Disconnected'); // Connected / Connecting / Disconnected
  const [cameraSource, setCameraSource] = useState('0');
  const [activeCameraName, setActiveCameraName] = useState('Default Stream');
  
  const [cameraCount, setCameraCount] = useState(1);
  const [logsCount, setLogsCount] = useState(0);
  const [latestSnapshot, setLatestSnapshot] = useState(null);
  const [latencyMs, setLatencyMs] = useState(24);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('visitor_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLoginSuccess = (userData) => {
    localStorage.setItem('visitor_user', JSON.stringify(userData));
    setUser(userData);
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    if (window.confirm("Disconnect and lock down this security workstation?")) {
      localStorage.removeItem('visitor_user');
      setUser(null);
    }
  };

  const fetchStatus = async () => {
    if (!user) return;
    const start = Date.now();
    try {
      const response = await axios.get(`${API_BASE_URL}/api/status`, {
        headers: { 'X-User-Id': user.id }
      });
      setCameraStatus(response.data.status);
      setCameraSource(response.data.source || '0');
      setLatencyMs(Math.max(12, Math.min(85, Date.now() - start)));
    } catch (error) {
      console.error('Failed to connect to backend api status', error);
      setCameraStatus('Disconnected');
    }
  };

  const fetchStatsCounts = async () => {
    if (!user) return;
    try {
      const [camsRes, logsRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/cameras`, { headers: { 'X-User-Id': user.id } }),
        axios.get(`${API_BASE_URL}/api/logs`)
      ]);

      if (camsRes.status === 'fulfilled' && Array.isArray(camsRes.value.data)) {
        setCameraCount(camsRes.value.data.length || 1);
        const activeCam = camsRes.value.data.find(c => String(c.source) === String(cameraSource));
        if (activeCam) {
          setActiveCameraName(activeCam.name);
        } else if (camsRes.value.data[0]) {
          setActiveCameraName(camsRes.value.data[0].name);
        }
      }

      if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value.data)) {
        setLogsCount(logsRes.value.data.length);
        if (logsRes.value.data.length > 0 && !latestSnapshot) {
          setLatestSnapshot(logsRes.value.data[0].imageUrl);
        }
      }
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  // Poll camera status & stats
  useEffect(() => {
    if (!user) return;
    fetchStatus();
    fetchStatsCounts();
    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [user, cameraSource]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('#adminPill') && !e.target.closest('#profileDropdown')) {
        setProfileDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="relative z-10 flex flex-col min-h-screen text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Ambient Glow Effects in Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[25%] left-1/4 w-[650px] h-[650px] bg-emerald-500/5 rounded-full blur-[140px]"></div>
        <div className="absolute top-[40%] -right-[15%] w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px]"></div>
      </div>

      {/* 1. TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 border-b border-white/10 glass-panel">
        <div className="max-w-[1720px] mx-auto px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Left: Logo & System Title */}
          <div className="flex items-center gap-6">
            <div 
              className="flex items-center gap-3 cursor-pointer group" 
              onClick={() => setActiveTab('live')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600/30 to-violet-600/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-950/40 group-hover:border-emerald-400 transition-all">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-wider text-base text-white">
                    VISITOR<span className="text-emerald-400">GUARD</span>
                  </span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    SOC v2.4
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono tracking-tight">
                  Wi-Fi CCTV Surveillance System
                </p>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="h-6 w-px bg-white/10 hidden md:block"></div>

            {/* Live Connection Status Pill */}
            <div className="hidden sm:flex items-center gap-3">
              <div 
                className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${
                  cameraStatus === 'Connected'
                    ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
                    : cameraStatus === 'Connecting'
                    ? 'bg-amber-950/50 border-amber-500/30 text-amber-300'
                    : 'bg-rose-950/50 border-rose-500/30 text-rose-300'
                }`}
                title={`Camera status: ${cameraStatus}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${
                  cameraStatus === 'Connected' 
                    ? 'bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse'
                    : cameraStatus === 'Connecting'
                    ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-ping'
                    : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'
                }`} />
                <span className="text-xs font-mono font-medium">{cameraStatus}</span>
                <Wifi className={`w-3.5 h-3.5 ml-0.5 ${
                  cameraStatus === 'Connected' ? 'text-emerald-400' : 'text-slate-400'
                }`} />
              </div>

              {/* Current Active Stream Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900/80 border border-white/10 text-xs font-mono text-slate-300">
                <Video className="w-3.5 h-3.5 text-violet-400" />
                <span className="font-medium truncate max-w-[140px]">
                  {cameraSource === '0' ? 'Local Webcam #0' : activeCameraName || `Source: ${cameraSource}`}
                </span>
                <span className="text-[10px] text-slate-500">| 1080p</span>
              </div>
            </div>
          </div>

          {/* Center: Navigation Tabs */}
          <nav className="hidden md:flex items-center bg-neutral-900/80 p-1 rounded-xl border border-white/10 font-medium text-xs">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all ${
                activeTab === 'live'
                  ? 'text-emerald-400 bg-neutral-800/90 shadow-sm border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Live Monitor</span>
              {activeTab === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
            </button>

            <button
              onClick={() => setActiveTab('cameras')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all ${
                activeTab === 'cameras'
                  ? 'text-emerald-400 bg-neutral-800/90 shadow-sm border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Cctv className="w-4 h-4" />
              <span>Saved Cameras</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {cameraCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all ${
                activeTab === 'logs'
                  ? 'text-emerald-400 bg-neutral-800/90 shadow-sm border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Visitor Logs</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/40 font-mono">
                {logsCount}
              </span>
            </button>
          </nav>

          {/* Right: System Metrics & Admin Profile Pill */}
          <div className="flex items-center gap-3">
            {/* Latency Telemetry */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-900/50 border border-white/5 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1 text-slate-300">
                <Cpu className="w-3.5 h-3.5 text-slate-400" /> 14%
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" /> {latencyMs}ms
              </span>
            </div>

            {/* Profile Pill */}
            <div className="relative">
              <div 
                id="adminPill"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 p-1 pl-2 pr-3 rounded-full bg-neutral-900/90 border border-white/10 hover:border-violet-500/50 cursor-pointer transition"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow">
                  {user.username ? user.username.substring(0, 2).toUpperCase() : 'AD'}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-white leading-none">{user.username}</div>
                  <div className="text-[10px] font-mono text-emerald-400 leading-tight">Master Auth</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </div>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div 
                  id="profileDropdown"
                  className="absolute right-0 mt-2 w-52 rounded-xl glass-card p-2 shadow-2xl z-50 border border-white/10"
                >
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <p className="text-xs font-bold text-white">Station: Alpha SOC-1</p>
                    <p className="text-[11px] font-mono text-slate-400">Operator: {user.username}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      setAuthMode('signin');
                      setShowAuthModal(true);
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-violet-400" />
                    <span>Switch Operator</span>
                  </button>
                  <button 
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      setAuthMode('signup');
                      setShowAuthModal(true);
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Register Operator</span>
                  </button>
                  <div className="my-1 border-t border-white/10"></div>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout Station</span>
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Mobile Tab Bar Strip */}
        <div className="flex md:hidden border-t border-white/10 px-3 py-2 justify-around bg-neutral-950/90 text-xs">
          <button 
            className={`flex items-center gap-1.5 py-1 px-3 ${activeTab === 'live' ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}
            onClick={() => setActiveTab('live')}
          >
            <Activity className="w-4 h-4" /> Live
          </button>
          <button 
            className={`flex items-center gap-1.5 py-1 px-3 ${activeTab === 'cameras' ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}
            onClick={() => setActiveTab('cameras')}
          >
            <Cctv className="w-4 h-4" /> Cameras ({cameraCount})
          </button>
          <button 
            className={`flex items-center gap-1.5 py-1 px-3 ${activeTab === 'logs' ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}
            onClick={() => setActiveTab('logs')}
          >
            <Users className="w-4 h-4" /> Logs ({logsCount})
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 lg:p-6 flex flex-col gap-6">
        
        {activeTab === 'live' ? (
          <LiveFeed 
            cameraStatus={cameraStatus} 
            cameraSource={cameraSource}
            activeCameraName={activeCameraName}
            fetchStatus={fetchStatus} 
            user={user}
            onLogCreated={() => {
              fetchStatsCounts();
            }}
            onSwitchTab={setActiveTab}
            latestSnapshot={latestSnapshot}
            setLatestSnapshot={setLatestSnapshot}
          />
        ) : activeTab === 'cameras' ? (
          <SavedCameras 
            currentSource={cameraSource} 
            fetchStatus={fetchStatus} 
            user={user} 
            onCamerasUpdated={fetchStatsCounts}
            onSwitchToLive={() => setActiveTab('live')}
          />
        ) : (
          <VisitorLogs 
            onLogsUpdated={fetchStatsCounts} 
            user={user}
          />
        )}

        {/* SOC Real-Time Telemetry Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
          <div className="glass-panel rounded-xl p-3.5 border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Cctv className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-mono">ONLINE CAMERAS</p>
              <p className="text-lg font-extrabold text-white font-mono">
                {cameraCount} <span className="text-xs font-normal text-slate-400">/ {cameraCount} Active</span>
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-3.5 border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-mono">VISITORS LOGGED</p>
              <p className="text-lg font-extrabold text-white font-mono">
                {logsCount} <span className="text-xs font-normal text-emerald-400 font-sans">+live</span>
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-3.5 border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-mono">NVR STORAGE</p>
              <p className="text-lg font-extrabold text-white font-mono">
                1.82 <span className="text-xs font-normal text-slate-400">TB (78%)</span>
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-3.5 border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-mono">SYS HEALTH</p>
              <p className="text-lg font-extrabold text-emerald-400 font-mono">
                99.98% <span className="text-xs text-slate-400">NOMINAL</span>
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* FOOTER STATUS STRIP */}
      <footer className="border-t border-white/5 bg-neutral-950/70 text-slate-500 text-xs py-3 px-6 mt-auto">
        <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> VISITOR GUARD SECURE SOC
            </span>
            <span>•</span>
            <span>FIRMWARE: 4.19.0-VG-RELEASE</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>RTSP PROTOCOL: 554/TCP</span>
            <span>LATENCY: &lt;{latencyMs}ms</span>
            <span className="text-emerald-400 font-bold">LIVE TELEMETRY SYNCED</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal Switcher if triggered from dropdown */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md">
            <Auth 
              initialMode={authMode} 
              onLoginSuccess={handleLoginSuccess} 
              onClose={() => setShowAuthModal(false)}
            />
          </div>
        </div>
      )}

    </div>
  );
}
