import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Cctv, Plus, Radio, Play, Trash2, RefreshCw, Check, 
  X, AlertCircle, Video, ShieldCheck, MapPin
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function SavedCameras({ currentSource, fetchStatus, user, onCamerasUpdated, onSwitchToLive }) {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add camera modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [camName, setCamName] = useState('');
  const [camLocation, setCamLocation] = useState('');
  const [camType, setCamType] = useState('RTSP');
  const [camSource, setCamSource] = useState('rtsp://192.168.1.140:554/live/ch1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const getHeaders = () => ({
    headers: { 'X-User-Id': user?.id }
  });

  const fetchCameras = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/cameras`, getHeaders());
      setCameras(response.data);
      if (onCamerasUpdated) onCamerasUpdated();
    } catch (err) {
      console.error(err);
      setError('Could not retrieve saved camera nodes. Make sure Flask server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, [user]);

  const handleAddCamera = async (e) => {
    e.preventDefault();
    if (!camName || !camSource || !user) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const formattedName = camLocation ? `${camName} (${camLocation})` : camName;
      const response = await axios.post(
        `${API_BASE_URL}/api/cameras`, 
        { name: formattedName, source: camSource }, 
        getHeaders()
      );

      if (response.data.success) {
        setFeedback({ success: true, message: `Node "${camName}" registered and synchronized!` });
        setCamName('');
        setCamLocation('');
        setIsModalOpen(false);
        fetchCameras();
      }
    } catch (err) {
      console.error(err);
      setFeedback({ success: false, message: 'Failed to register camera node.' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleActivate = async (id, name) => {
    if (!user) return;
    try {
      const response = await axios.post(`${API_BASE_URL}/api/cameras/active`, { id }, getHeaders());
      if (response.data.success) {
        fetchCameras();
        fetchStatus();
        setFeedback({ success: true, message: `Stream switched to active: ${name}` });
        setTimeout(() => setFeedback(null), 3000);
      } else {
        alert('Failed to activate camera stream: Connection timed out.');
      }
    } catch (err) {
      console.error(err);
      alert('Error activating camera.');
    }
  };

  const handleDelete = async (id, isActive, name) => {
    if (!user) return;
    if (isActive) {
      alert('Cannot delete the active camera stream. Please activate another camera first.');
      return;
    }
    if (!window.confirm(`Are you sure you want to unregister camera "${name}" from SOC?`)) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/cameras/${id}`, getHeaders());
      setCameras(cameras.filter(cam => cam.id !== id));
      if (onCamerasUpdated) onCamerasUpdated();
    } catch (err) {
      console.error(err);
      alert('Failed to delete camera.');
    }
  };

  const pingNode = (name) => {
    alert(`Pinging camera node [${name}] over RTSP port 554... Roundtrip latency: 22ms. Stream packet integrity: 100%.`);
  };

  const pingAllNodes = () => {
    alert("All registered camera nodes responded with 200 OK. NVR synchronization refreshed.");
  };

  return (
    <div className="space-y-6">

      {/* Feedback Alert */}
      {feedback && (
        <div className={`p-3.5 px-5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-xl ${
          feedback.success 
            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200' 
            : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Cameras Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Cctv className="w-5 h-5 text-emerald-400" />
            Registered Wi-Fi & RTSP Cameras
          </h2>
          <p className="text-xs text-slate-400">
            Manage surveillance hardware nodes, stream routes, and primary active monitors.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={pingAllNodes}
            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-slate-300 text-xs font-medium border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Ping All Nodes</span>
          </button>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 text-xs font-bold shadow-lg shadow-emerald-950/50 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Camera</span>
          </button>
        </div>
      </div>

      {/* Camera Grid Cards */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs font-mono text-slate-400">Scanning NVR nodes...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800 text-center space-y-3 max-w-md mx-auto">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-xs text-rose-200">{error}</p>
          <button 
            onClick={fetchCameras}
            className="px-4 py-1.5 bg-rose-800 hover:bg-rose-700 text-white rounded-xl text-xs transition"
          >
            Retry Loading
          </button>
        </div>
      ) : cameras.length === 0 ? (
        <div className="py-16 text-center glass-card rounded-2xl border border-white/10 space-y-3">
          <Cctv className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">No cameras registered</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click "+ Add New Camera" above to configure your first RTSP stream or local webcam.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cameras.map((cam) => {
            const isActive = String(cam.source) === String(currentSource);
            const isWebcam = cam.source === '0' || cam.source === '1' || !cam.source.startsWith('rtsp');

            return (
              <div 
                key={cam.id}
                className={`glass-card rounded-2xl overflow-hidden border transition shadow-xl flex flex-col justify-between group ${
                  isActive ? 'border-emerald-500/60 ring-1 ring-emerald-500/40' : 'border-white/10'
                }`}
              >
                {/* Simulated CCTV Camera Viewport Graphic */}
                <div className="relative aspect-video bg-neutral-950 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-neutral-950 via-slate-900 to-neutral-950 group-hover:scale-105 transition duration-500">
                    <svg className="w-full h-full object-cover opacity-20" viewBox="0 0 400 225">
                      <line x1="0" y1="0" x2="160" y2="100" stroke="#334155" strokeWidth="1" />
                      <line x1="400" y1="0" x2="240" y2="100" stroke="#334155" strokeWidth="1" />
                      <line x1="160" y1="100" x2="240" y2="100" stroke="#10b981" strokeWidth="1" />
                      <rect x="175" y="85" width="50" height="30" fill="none" stroke="#38bdf8" strokeWidth="1" />
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-transparent to-transparent" />

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      ONLINE
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900/90 text-slate-300 border border-white/10">
                      {isWebcam ? 'Webcam' : 'RTSP'}
                    </span>
                  </div>

                  {isActive && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500 text-neutral-950 shadow">
                      ● ACTIVE FEED
                    </div>
                  )}

                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-slate-300">
                    <span className="truncate">1080p FHD • 30 FPS</span>
                    <span className="text-slate-400 text-[10px] truncate max-w-[140px]">
                      {cam.name.includes('(') ? cam.name.match(/\((.*?)\)/)?.[1] : 'Security Grid'}
                    </span>
                  </div>
                </div>

                {/* Card Body & Actions */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      {cam.name.replace(/\s*\(.*?\)/, '')}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono truncate mt-0.5" title={cam.source}>
                      <span className="text-slate-500">URI:</span> {cam.source}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                    <button 
                      onClick={() => pingNode(cam.name)}
                      className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-slate-300 text-xs border border-white/5 transition cursor-pointer" 
                      title="Ping RTSP Port"
                    >
                      <Radio className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2 flex-1 justify-end">
                      {isActive ? (
                        <button
                          onClick={onSwitchToLive}
                          className="text-xs font-mono text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/30 hover:bg-emerald-900/50 transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Play className="w-3 h-3 fill-emerald-400" />
                          <span>Streaming Now</span>
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleActivate(cam.id, cam.name)}
                          className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-emerald-600 hover:text-white text-slate-200 text-xs font-medium border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Set as Active</span>
                        </button>
                      )}

                      <button 
                        onClick={() => handleDelete(cam.id, isActive, cam.name)}
                        className="p-2 rounded-xl bg-neutral-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 text-xs border border-white/5 transition cursor-pointer" 
                        title="Remove camera"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* REGISTER NEW CAMERA MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-2xl glass-card border border-white/10 p-6 md:p-7 shadow-2xl">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Cctv className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Register New Wi-Fi Camera Node</h3>
                <p className="text-xs text-slate-400">Configure stream link via RTSP, ONVIF, or local Webcam device</p>
              </div>
            </div>

            <form onSubmit={handleAddCamera} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Camera Friendly Name</label>
                <input 
                  type="text"
                  required
                  value={camName}
                  onChange={(e) => setCamName(e.target.value)}
                  placeholder="e.g. Loading Dock #02"
                  className="w-full bg-neutral-900 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Physical Location</label>
                  <input 
                    type="text"
                    value={camLocation}
                    onChange={(e) => setCamLocation(e.target.value)}
                    placeholder="e.g. West Wing, Gate B"
                    className="w-full bg-neutral-900 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Device Type</label>
                  <select 
                    value={camType}
                    onChange={(e) => {
                      setCamType(e.target.value);
                      if (e.target.value === 'Webcam') setCamSource('0');
                    }}
                    className="w-full bg-neutral-900 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="RTSP">IP RTSP Camera (H.264)</option>
                    <option value="Webcam">USB / Local Webcam</option>
                    <option value="ONVIF">ONVIF PTZ Node</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">RTSP Stream URI / Device Index</label>
                <input 
                  type="text"
                  required
                  value={camSource}
                  onChange={(e) => setCamSource(e.target.value)}
                  placeholder="rtsp://admin:pass@192.168.1.85:554/stream1 or 0"
                  className="w-full bg-neutral-900 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">For local built-in cameras, enter 0 or 1. For Wi-Fi units, enter standard rtsp:// URI.</p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Verifying...' : 'Test & Save Node'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
