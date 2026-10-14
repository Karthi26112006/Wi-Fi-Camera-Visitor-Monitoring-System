import React, { useState } from 'react';
import axios from 'axios';
import { ShieldCheck, User, Lock, AlertTriangle, X, Shield, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Auth({ onLoginSuccess, initialMode = 'signin', onClose }) {
  const [isLogin, setIsLogin] = useState(initialMode === 'signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const endpoint = isLogin ? 'login' : 'register';

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/${endpoint}`, {
        username,
        password
      });

      if (response.data.success) {
        if (isLogin) {
          setSuccess('Operator authenticated. Initializing SOC workspace...');
          setTimeout(() => {
            onLoginSuccess(response.data.user);
          }, 800);
        } else {
          setSuccess('Operator credentials enrolled. Switching to sign-in...');
          setUsername('');
          setPassword('');
          setConfirmPassword('');
          setTimeout(() => {
            setIsLogin(true);
            setSuccess('');
          }, 1200);
        }
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Network error. Check if Flask backend is active on port 5000.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a10] crt-grid flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Ambient Glows */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main Glass Card */}
      <div className="relative w-full max-w-md rounded-2xl glass-card border border-white/10 p-6 md:p-8 shadow-2xl overflow-hidden z-10">
        
        {/* Close Button if opened in modal overlay */}
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Logo Title */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500/30 to-violet-600/30 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3 text-emerald-400 shadow-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">
            {isLogin ? 'Operator Station Authentication' : 'Enroll New Security Operator'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Access the Visitor Guard Surveillance Control Gateway
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex p-1 rounded-xl bg-neutral-900 border border-white/10 mb-6 text-xs font-semibold">
          <button 
            type="button"
            onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 rounded-lg transition ${
              isLogin 
                ? 'bg-neutral-800 text-emerald-400 border border-emerald-500/30 shadow' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button 
            type="button"
            onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 rounded-lg transition ${
              !isLogin 
                ? 'bg-neutral-800 text-emerald-400 border border-emerald-500/30 shadow' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign Up (Register)
          </button>
        </div>

        {/* Alert Feedback */}
        {error && (
          <div className="mb-4 p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Security Username or Badge ID
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin_soc_01"
                className="w-full bg-neutral-900 border border-white/10 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Password / Passcode
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-neutral-900 border border-white/10 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition font-mono"
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Confirm Passcode
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input 
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-neutral-900 border border-white/10 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition font-mono"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-1 text-slate-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded border-slate-700 text-emerald-500 bg-neutral-900" />
              <span>Remember station</span>
            </label>
            <span className="text-emerald-400 text-[11px] font-mono">TLS 1.3 Station Link</span>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-bold text-xs shadow-lg shadow-emerald-950/60 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Shield className="w-4 h-4" />
            <span>{loading ? 'Authorizing Station...' : isLogin ? 'Authorize & Connect Station' : 'Enroll Security Operator'}</span>
          </button>
        </form>

        <div className="mt-5 text-center text-[11px] text-slate-500 font-mono">
          TLS 1.3 Certified Hardware Handshake
        </div>

      </div>

    </div>
  );
}
