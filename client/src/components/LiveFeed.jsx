import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Pause, Play, RefreshCw, Camera, SlidersHorizontal, Maximize, 
  UserCheck, Crosshair, User, Save, Clock, Mic, MicOff, 
  AlertCircle, Shield, X, Check, Volume2, VolumeX, Eye
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function LiveFeed({ 
  cameraStatus, 
  cameraSource, 
  activeCameraName, 
  fetchStatus, 
  user,
  onLogCreated,
  onSwitchTab,
  latestSnapshot,
  setLatestSnapshot
}) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Settings modal & overlay toggles
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showReticle, setShowReticle] = useState(true);
  const [showOsd, setShowOsd] = useState(true);
  const [sensitivity, setSensitivity] = useState(75);
  const [qualityProfile, setQualityProfile] = useState('1080p Ultra HD (30 FPS, 5.0 Mbps)');

  // Visitor Intake Form
  const [visitorName, setVisitorName] = useState('');
  const [visitorCategory, setVisitorCategory] = useState('Guest');
  const [visitorNote, setVisitorNote] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [toast, setToast] = useState(null); // { success: boolean, message: string }

  // Military clock state
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  // Mini recent visitors list
  const [recentVisitors, setRecentVisitors] = useState([]);

  // Audio streaming state
  const [audioMuted, setAudioMuted] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(null);
  const [audioConnecting, setAudioConnecting] = useState(false);
  const [audioError, setAudioError] = useState(null);

  const containerRef = useRef(null);
  const audioRef = useRef(null);

  const isConnected = cameraStatus === 'Connected';

  // Live military clock interval
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const da = String(now.getDate()).padStart(2, '0');
      const hr = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      const se = String(now.getSeconds()).padStart(2, '0');
      setCurrentTimeStr(`${yr}-${mo}-${da} ${hr}:${mi}:${se} UTC`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch recent visitors for the sidebar mini-timeline
  const fetchRecentVisitors = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/logs`);
      if (Array.isArray(res.data)) {
        setRecentVisitors(res.data.slice(0, 3));
      }
    } catch (err) {
      console.error('Failed to fetch recent logs', err);
    }
  };

  useEffect(() => {
    fetchRecentVisitors();
  }, []);

  // Check audio capabilities
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/audio_check`)
      .then(res => setAudioAvailable(res.data.available))
      .catch(() => setAudioAvailable(false));
  }, []);

  // Audio cleanup on disconnect / unmount
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
      audioRef.current = null;
    }
    setAudioMuted(true);
    setAudioConnecting(false);
    setAudioError(null);
  };

  useEffect(() => {
    if (!isConnected) stopAudio();
  }, [isConnected]);

  useEffect(() => {
    return () => stopAudio();
  }, []);

  const startAudio = () => {
    if (!isConnected || !audioAvailable) return;
    setAudioConnecting(true);
    setAudioError(null);

    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    audio.oncanplay = () => {
      setAudioConnecting(false);
      setAudioMuted(false);
    };

    audio.onerror = () => {
      setAudioConnecting(false);
      setAudioMuted(true);
      setAudioError('Audio stream unavailable. Camera might not have an audio channel.');
      audioRef.current = null;
      setTimeout(() => setAudioError(null), 5000);
    };

    const audioUrl = cameraSource && cameraSource !== '0'
      ? `${API_BASE_URL}/api/audio_feed?user_id=${user?.id}&url=${encodeURIComponent(cameraSource)}&t=${Date.now()}`
      : `${API_BASE_URL}/api/audio_feed?user_id=${user?.id}&t=${Date.now()}`;
    
    audio.src = audioUrl;
    audioRef.current = audio;

    audio.play()
      .then(() => {
        setAudioConnecting(false);
        setAudioMuted(false);
      })
      .catch(err => {
        console.error('[Audio] Play error', err);
        setAudioConnecting(false);
        setAudioMuted(true);
        audioRef.current = null;
      });
  };

  const toggleAudio = () => {
    if (audioMuted) {
      startAudio();
    } else {
      stopAudio();
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => console.error(err));
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleRefreshStream = () => {
    setIsRefreshing(true);
    fetchStatus();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1200);
  };

  // Quick snapshot capture without text input
  const handleQuickSnapshot = async () => {
    if (!isConnected) {
      setToast({ success: false, message: 'Camera is offline. Cannot capture frame.' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/capture`, { 
        note: `Quick Snapshot [${new Date().toLocaleTimeString()}]` 
      }, {
        headers: { 'X-User-Id': user?.id }
      });

      if (response.data.success) {
        const fullUrl = `${API_BASE_URL}/api/snapshots/${response.data.log.filename}`;
        setLatestSnapshot(fullUrl);
        setToast({ success: true, message: `Quick snapshot saved: ${response.data.log.filename}` });
        if (onLogCreated) onLogCreated();
        fetchRecentVisitors();
      }
    } catch (err) {
      console.error(err);
      setToast({ success: false, message: 'Failed to record snapshot.' });
    }
    setTimeout(() => setToast(null), 3500);
  };

  // Full Visitor intake capture
  const handleIntakeSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!visitorName.trim()) {
      setToast({ success: false, message: 'Please specify visitor name or badge ID before committing to log.' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setIsCapturing(true);
    const combinedNote = `[${visitorCategory}] ${visitorName.trim()} - ${visitorNote.trim() || 'Visitor logged via Alpha SOC Checkpoint.'}`;

    try {
      const response = await axios.post(`${API_BASE_URL}/api/capture`, { 
        note: combinedNote 
      }, {
        headers: { 'X-User-Id': user?.id }
      });

      if (response.data.success) {
        const fullUrl = `${API_BASE_URL}/api/snapshots/${response.data.log.filename}`;
        setLatestSnapshot(fullUrl);
        setToast({ success: true, message: `Visitor "${visitorName}" verified & logged into SOC registry.` });
        setVisitorName('');
        setVisitorNote('');
        if (onLogCreated) onLogCreated();
        fetchRecentVisitors();
      } else {
        setToast({ success: false, message: response.data.message || 'Capture failed.' });
      }
    } catch (err) {
      console.error(err);
      setToast({ success: false, message: 'Backend connection error. Make sure Flask is running on port 5000.' });
    } finally {
      setIsCapturing(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const streamUrl = isConnected && isPlaying
    ? `${API_BASE_URL}/api/video_feed?user_id=${user?.id}&t=${isRefreshing ? Date.now() : ''}`
    : null;

  return (
    <div className="space-y-6">
      
      {/* Toast Alert Notification */}
      {toast && (
        <div className={`flex items-center justify-between p-3.5 px-5 rounded-xl border shadow-xl transition-all ${
          toast.success 
            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200' 
            : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${toast.success ? 'bg-emerald-400' : 'bg-rose-400'} animate-ping`} />
            <span className="text-xs font-semibold">{toast.message}</span>
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-xs p-1 rounded hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Primary Video Feed Viewport (8 Columns on Large) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div 
            ref={containerRef}
            className={`relative group rounded-2xl overflow-hidden glass-card border border-white/10 bg-neutral-950 shadow-2xl aspect-[16/9] flex items-center justify-center ${
              isFullscreen ? 'fixed inset-0 z-50 rounded-none w-screen h-screen' : ''
            }`}
          >
            
            {/* Live Video Feed Image */}
            {streamUrl ? (
              <img 
                src={streamUrl} 
                alt="Live Camera Stream"
                className="w-full h-full object-contain bg-black"
                onError={() => {
                  fetchStatus();
                }}
              />
            ) : (
              /* Simulated CCTV Hallway Room Graphic when offline or frozen */
              <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/30 via-neutral-950/90 to-neutral-950 flex flex-col items-center justify-center">
                <svg className="w-full h-full object-cover opacity-25" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 450">
                  <defs>
                    <linearGradient id="hallwayGrad" x1="0%" x2="100%" y1="0%" y2="100%">
                      <stop offset="0%" stopColor="#0f172a" />
                      <stop offset="50%" stopColor="#1e1b4b" />
                      <stop offset="100%" stopColor="#030712" />
                    </linearGradient>
                  </defs>
                  <rect fill="url(#hallwayGrad)" height="450" width="800" />
                  <path d="M 0 0 L 250 180 L 250 290 L 0 450 Z" fill="#090d16" opacity="0.8" />
                  <path d="M 800 0 L 550 180 L 550 290 L 800 450 Z" fill="#0b101c" opacity="0.8" />
                  <line stroke="#334155" strokeDasharray="4,4" strokeWidth="1.5" x1="250" x2="550" y1="180" y2="180" />
                  <line stroke="#1e293b" strokeWidth="2" x1="250" x2="550" y1="290" y2="290" />
                  <rect fill="none" height="130" opacity="0.4" stroke="#3b82f6" strokeWidth="1" width="120" x="340" y="160" />
                  <circle cx="400" cy="225" fill="none" r="30" stroke="#10b981" strokeDasharray="3,3" strokeWidth="0.75" />
                </svg>

                <div className="absolute flex flex-col items-center justify-center text-center p-6 space-y-3 z-20">
                  <div className="p-3 bg-neutral-900/80 rounded-2xl border border-white/10 text-amber-400">
                    <AlertCircle className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-wide">
                      {isPlaying ? 'Camera Stream Disconnected' : 'Feed Frozen (Paused)'}
                    </h4>
                    <p className="text-slate-400 text-xs font-mono mt-1 max-w-sm">
                      {isPlaying 
                        ? `Awaiting RTSP frame buffer from ${cameraSource || '0'}. Ensure Flask server & camera are online.`
                        : 'Stream display is paused by operator. Click Resume Feed below.'
                      }
                    </p>
                  </div>
                  <button 
                    onClick={handleRefreshStream}
                    className="px-4 py-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center gap-2 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Connection
                  </button>
                </div>
              </div>
            )}

            {/* Scanning Line Motion Overlay */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25 z-10">
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent blur-sm animate-scanline"></div>
            </div>

            {/* HUD Security Reticle Brackets */}
            <div className="hud-bracket-tl"></div>
            <div className="hud-bracket-tr"></div>
            <div className="hud-bracket-bl"></div>
            <div className="hud-bracket-br"></div>

            {/* Simulated Detection Reticle Box */}
            {showReticle && isConnected && isPlaying && (
              <div className="absolute w-44 h-48 border-2 border-emerald-400/80 rounded bg-emerald-500/5 pointer-events-none flex flex-col justify-between p-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] z-20">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-mono bg-emerald-500 text-neutral-950 font-bold px-1 rounded-sm">OBJECT #209</span>
                  <span className="text-[9px] font-mono text-emerald-400 tracking-wider">CONF: 98.4%</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-[9px] font-mono text-slate-300">HUMAN / VISITOR</span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                    <span className="text-[9px] font-mono text-emerald-300">TRACKED</span>
                  </div>
                </div>
              </div>
            )}

            {/* Top Left Overlay Badges: LIVE STATUS + RESOLUTION */}
            {showOsd && (
              <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 z-20 pointer-events-none">
                <div className={`flex items-center gap-2 px-2.5 py-1 rounded bg-neutral-950/80 backdrop-blur-md border text-xs font-mono font-bold shadow-lg ${
                  isConnected 
                    ? 'border-red-500/40 text-red-400' 
                    : 'border-amber-500/40 text-amber-400'
                }`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    isConnected ? 'bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]' : 'bg-amber-400'
                  }`}></span>
                  <span>{isConnected ? 'LIVE' : 'STANDBY'}</span>
                  <span className="text-[10px] text-slate-400 font-normal">| 1080p 30fps</span>
                </div>
                <div className="px-2 py-1 rounded bg-neutral-950/80 backdrop-blur-md border border-white/10 font-mono text-[11px] text-slate-300">
                  <span className="text-emerald-400">FPS:</span> 29.98 • <span className="text-emerald-400">BITRATE:</span> 4.8 Mbps
                </div>
              </div>
            )}

            {/* Top Right Overlay: Date & Military Clock */}
            {showOsd && (
              <div className="absolute top-4 right-4 z-20 pointer-events-none">
                <div className="px-3 py-1 rounded bg-neutral-950/80 backdrop-blur-md border border-white/10 font-mono text-xs text-right">
                  <div className="text-white font-semibold">{currentTimeStr || '2026-10-12 16:20:00 UTC'}</div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                    <span className="text-emerald-400">CAM_UID:</span> VG-CAM-01 [{activeCameraName}]
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Overlay: Audio Level & Zone Tag */}
            <div className="absolute bottom-4 left-4 z-20 pointer-events-none hidden sm:flex items-center gap-3 font-mono text-[11px] text-slate-300">
              <div className="flex items-center gap-1.5 bg-neutral-950/80 px-2.5 py-1 rounded border border-white/10">
                {audioMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>AUDIO:</span>
                <span className={audioMuted ? 'text-slate-500' : 'text-emerald-400'}>
                  {audioMuted ? 'MUTED' : 'STREAMING'}
                </span>
                {!audioMuted && (
                  <div className="flex items-end gap-0.5 h-3 w-8 ml-1">
                    <div className="w-1.5 h-2 bg-emerald-500 animate-pulse"></div>
                    <div className="w-1.5 h-3 bg-emerald-500 animate-pulse"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-500"></div>
                  </div>
                )}
              </div>
              <div className="bg-neutral-950/80 px-2.5 py-1 rounded border border-white/10 text-slate-400">
                ENCRYPTION: <span className="text-emerald-400">TLS AES-256</span>
              </div>
            </div>

            {/* Re-establishing / Refresh Overlay */}
            {isRefreshing && (
              <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="font-mono text-xs text-slate-300">Re-establishing RTSP handshake with {activeCameraName}...</p>
              </div>
            )}

          </div>

          {/* Video Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 px-4 rounded-xl glass-panel border border-white/10">
            {/* Left Toolbar Actions */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-md transition ${
                  isPlaying 
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950' 
                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-950'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Freeze Feed' : 'Resume Feed'}</span>
              </button>

              <button 
                onClick={handleRefreshStream}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-slate-200 text-xs font-medium border border-white/5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh Stream</span>
              </button>

              <button 
                onClick={handleQuickSnapshot}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/30 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 text-xs font-medium transition"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Quick Snapshot</span>
              </button>

              {audioAvailable && (
                <button
                  onClick={toggleAudio}
                  disabled={!isConnected}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    !audioMuted 
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                      : 'bg-neutral-800 hover:bg-neutral-700 text-slate-300 border-white/5'
                  }`}
                  title={audioError || (audioMuted ? 'Listen Audio Stream' : 'Mute Audio')}
                >
                  {!audioMuted ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{audioConnecting ? 'Connecting...' : !audioMuted ? 'Mute' : 'Listen'}</span>
                </button>
              )}
            </div>

            {/* Right Toolbar Actions */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsConfigOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-slate-300 text-xs font-medium border border-white/5 transition"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                <span>Source Config</span>
              </button>

              <button 
                onClick={toggleFullscreen}
                className="p-1.5 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-slate-300 text-xs border border-white/5 transition" 
                title="Toggle Fullscreen"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Visitor Capture Card & Live Telemetry (4 Columns) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Visitor Capture & Logging Card */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Visitor Intake & Tagging</h3>
                    <p className="text-[11px] text-slate-400">Capture frame and write audit note</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-slate-300 border border-white/5">
                  FAST-LOG
                </span>
              </div>

              <form onSubmit={handleIntakeSubmit} className="mt-4 space-y-4">
                
                {/* Active Capture Preview Thumbnail Buffer */}
                <div className="relative rounded-xl overflow-hidden border border-white/10 bg-neutral-950 aspect-video flex items-center justify-center group">
                  {latestSnapshot ? (
                    <img 
                      src={latestSnapshot} 
                      alt="Latest Capture Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-3 text-slate-500">
                      <Camera className="w-6 h-6 mb-1 text-slate-600" />
                      <p className="text-[10px] font-mono">No prior snapshot buffer</p>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent flex items-end p-2.5 pointer-events-none">
                    <div className="flex items-center justify-between w-full text-[10px] font-mono text-slate-300">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Crosshair className="w-3 h-3" /> Frame Buffer 1080p
                      </span>
                      <span>Ready</span>
                    </div>
                  </div>
                </div>

                {/* Visitor Name Input */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Visitor Name / Identification</span>
                    <span className="text-[10px] text-slate-500 font-mono">Required</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input 
                      type="text" 
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      placeholder="e.g. David Vance (Courier - DHL)"
                      className="w-full bg-neutral-900/90 border border-white/10 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition font-sans"
                      required
                    />
                  </div>
                </div>

                {/* Category Tags */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Visitor Category</label>
                  <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                    {['Guest', 'Delivery', 'Contractor', 'VIP'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setVisitorCategory(cat)}
                        className={`py-1.5 px-2 rounded-lg border text-center font-medium transition ${
                          visitorCategory === cat 
                            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' 
                            : 'bg-neutral-900 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Security Notes Textarea */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Security Notes / Reason for Entry
                  </label>
                  <textarea 
                    value={visitorNote}
                    onChange={(e) => setVisitorNote(e.target.value)}
                    rows={2}
                    placeholder="Visiting Floor 3, engineering suite. Issued temporary RFID badge #14."
                    className="w-full bg-neutral-900/90 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                  />
                </div>

                {/* Submit Action Button */}
                <div className="pt-2 border-t border-white/10">
                  <button 
                    type="submit"
                    disabled={isCapturing}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-bold text-xs shadow-lg shadow-emerald-950/50 transition duration-150 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isCapturing ? 'Encrypting & Storing Frame...' : 'Capture & Log Visitor'}</span>
                  </button>
                </div>

              </form>
            </div>
          </div>

          {/* Quick Recent Visitors Mini-Timeline in Sidebar */}
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Recent Intakes
              </h4>
              <button 
                onClick={() => onSwitchTab('logs')}
                className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
              >
                View All →
              </button>
            </div>
            
            <div className="space-y-2.5">
              {recentVisitors.length === 0 ? (
                <p className="text-[11px] text-slate-500 font-mono py-2">No visitor logs recorded yet.</p>
              ) : (
                recentVisitors.map((r) => (
                  <div 
                    key={r.id}
                    onClick={() => onSwitchTab('logs')}
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-800/80 border border-white/5 cursor-pointer transition"
                  >
                    <img 
                      src={r.imageUrl} 
                      className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0" 
                      alt="Thumbnail"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-white truncate">
                          {r.note ? r.note.split(' - ')[0].replace(/\[.*?\]\s*/, '') : `Visitor #${r.id}`}
                        </p>
                        <span className="text-[9px] font-mono px-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                          {r.note && r.note.includes('[') ? r.note.match(/\[(.*?)\]/)?.[1] || 'Guest' : 'Verified'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{r.timestamp}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* STREAM CONFIGURATION MODAL */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl glass-card border border-white/10 p-6 shadow-2xl">
            <button 
              onClick={() => setIsConfigOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <SlidersHorizontal className="w-4 h-4 text-violet-400" />
              Stream & Display Configuration
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Stream Quality Profile</label>
                <select 
                  value={qualityProfile}
                  onChange={(e) => setQualityProfile(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option>1080p Ultra HD (30 FPS, 5.0 Mbps)</option>
                  <option>720p Balanced (30 FPS, 2.5 Mbps)</option>
                  <option>480p Low Bandwidth (15 FPS, 1.0 Mbps)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Detection Overlay Reticles</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={showReticle}
                      onChange={(e) => setShowReticle(e.target.checked)}
                      className="rounded bg-neutral-900 border-slate-700 text-emerald-500"
                    />
                    <span>Display AI Face & Motion Bounding Box</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={showOsd}
                      onChange={(e) => setShowOsd(e.target.checked)}
                      className="rounded bg-neutral-900 border-slate-700 text-emerald-500"
                    />
                    <span>Show Real-Time Bitrate & OSD Timestamp</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Motion Alarm Sensitivity</label>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={sensitivity}
                  onChange={(e) => setSensitivity(e.target.value)}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                  <span>Low (Threshold: 20%)</span>
                  <span className="text-emerald-400">Nominal: {sensitivity}%</span>
                  <span>Aggressive (95%)</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-white/10 flex justify-end">
              <button 
                onClick={() => setIsConfigOpen(false)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
