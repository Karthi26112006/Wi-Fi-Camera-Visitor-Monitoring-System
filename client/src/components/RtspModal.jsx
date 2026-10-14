import React, { useState } from 'react';
import { X, Video, ShieldAlert, Check } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export default function RtspModal({ isOpen, onClose, currentSource, onSourceUpdated, user }) {
  const [source, setSource] = useState(currentSource || '0');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { success: boolean, message: string }

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/config-rtsp`, { source }, {
        headers: { 'X-User-Id': user?.id }
      });
      if (response.data.success) {
        setFeedback({ success: true, message: `Connected to stream: ${source}` });
        onSourceUpdated(source);
        setTimeout(() => {
          onClose();
          setFeedback(null);
        }, 1500);
      } else {
        setFeedback({ success: false, message: 'Failed to connect. Using fallback or retrying...' });
      }
    } catch (error) {
      console.error(error);
      setFeedback({ success: false, message: 'Server error or connection timed out.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 transform scale-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Configure Camera Stream</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-white hover:bg-neutral-800 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Camera Source / RTSP URL
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-mono text-sm"
              placeholder="e.g. 0 (webcam) or rtsp://username:password@ip:port/h264"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              Enter <code className="bg-neutral-950 px-1 py-0.5 rounded text-neutral-400">0</code> for the default webcam, or provide a valid RTSP stream URL.
            </p>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-sm ${
              feedback.success 
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
                : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
            }`}>
              {feedback.success ? (
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-purple-500/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connecting...
                </>
              ) : (
                'Save Connection'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
