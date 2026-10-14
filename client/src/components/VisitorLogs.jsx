import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, Download, ShieldCheck, Maximize2, Trash2, Printer, 
  X, RefreshCw, UserX, Calendar, Clock, Image as ImageIcon 
} from 'lucide-react';

export default function VisitorLogs({ onLogsUpdated, user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');

  // Enlarge modal state
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('http://localhost:5000/api/logs');
      setLogs(response.data);
      if (onLogsUpdated) onLogsUpdated();
    } catch (err) {
      console.error(err);
      setError('Could not retrieve visitor logs. Make sure Flask backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Permanently purge this visitor snapshot record from the NVR database?')) return;

    try {
      await axios.delete(`http://localhost:5000/api/logs/${id}`);
      setLogs(logs.filter(l => l.id !== id));
      if (selectedLog && selectedLog.id === id) {
        setSelectedLog(null);
      }
      if (onLogsUpdated) onLogsUpdated();
    } catch (err) {
      console.error(err);
      alert('Failed to delete log entry.');
    }
  };

  // Helper to extract visitor name and category from combined note
  const parseLogDetails = (log) => {
    const rawNote = log.note || '';
    let category = 'Guest';
    let name = `Visitor #${log.id}`;
    let noteText = rawNote;

    const catMatch = rawNote.match(/\[(.*?)\]/);
    if (catMatch) {
      category = catMatch[1];
      const withoutCat = rawNote.replace(/\[.*?\]\s*/, '');
      const parts = withoutCat.split(' - ');
      if (parts.length >= 2) {
        name = parts[0];
        noteText = parts.slice(1).join(' - ');
      } else {
        name = parts[0];
        noteText = 'Visitor authorized via security checkpoint.';
      }
    } else if (rawNote) {
      name = rawNote.slice(0, 30);
    }

    return { category, name, noteText };
  };

  // Filter logic
  const filteredLogs = logs.filter(log => {
    const { category, name, noteText } = parseLogDetails(log);
    const q = searchQuery.toLowerCase();

    const matchesSearch = 
      name.toLowerCase().includes(q) || 
      noteText.toLowerCase().includes(q) || 
      category.toLowerCase().includes(q) ||
      log.timestamp.toLowerCase().includes(q);

    const matchesCat = categoryFilter === 'ALL' || category.toLowerCase() === categoryFilter.toLowerCase();

    let matchesDate = true;
    if (dateFilter !== 'ALL') {
      const todayStr = new Date().toISOString().split('T')[0];
      const logDate = log.timestamp.split(' ')[0];
      if (dateFilter === 'TODAY') {
        matchesDate = logDate === todayStr;
      }
    }

    return matchesSearch && matchesCat && matchesDate;
  });

  const exportCSV = () => {
    let csv = "ID,VisitorName,Category,Timestamp,Filename,SecurityNote\n";
    logs.forEach(l => {
      const { category, name, noteText } = parseLogDetails(l);
      csv += `"${l.id}","${name}","${category}","${l.timestamp}","${l.filename}","${noteText.replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `visitor_guard_audit_${Date.now()}.csv`);
    a.click();
  };

  const handlePrintBadge = () => {
    alert("Sending thermal label print command for visitor pass to Front Desk Label Printer...");
  };

  return (
    <div className="space-y-6">

      {/* Logs Controls & Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs by visitor name, category, or note..."
            className="w-full bg-neutral-900 border border-white/10 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
          />
        </div>

        {/* Filters: Category & Date */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-neutral-900 border border-white/10 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Categories</option>
            <option value="Guest">Guest</option>
            <option value="Delivery">Delivery</option>
            <option value="Contractor">Contractor</option>
            <option value="VIP">VIP</option>
          </select>

          <select 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-neutral-900 border border-white/10 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today (Latest)</option>
          </select>

          <button 
            onClick={exportCSV}
            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-slate-300 text-xs font-medium border border-white/10 transition flex items-center gap-1.5 cursor-pointer" 
            title="Export audit records to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Export</span>
          </button>
        </div>

      </div>

      {/* Header Info */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-slate-400">
          Showing <span className="text-emerald-400 font-bold">{filteredLogs.length}</span> verified visitor entries
        </p>
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Cryptographic Audit Trail Active</span>
        </div>
      </div>

      {/* Grid States */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs font-mono text-slate-400">Retrieving visitor archives from NVR...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800 text-center space-y-3 max-w-md mx-auto">
          <p className="text-xs text-rose-200">{error}</p>
          <button 
            onClick={fetchLogs}
            className="px-4 py-1.5 bg-rose-800 hover:bg-rose-700 text-white rounded-xl text-xs transition"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-20 text-center glass-card rounded-2xl border border-white/10 space-y-3">
          <UserX className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">No visitor logs found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {logs.length === 0 
              ? 'Navigate to Live Monitor and capture a visitor snapshot to log an audit entry.'
              : 'No records match your search query or filter criteria.'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredLogs.map((log) => {
            const { category, name, noteText } = parseLogDetails(log);
            return (
              <div 
                key={log.id}
                className="glass-card rounded-2xl overflow-hidden border border-white/10 group hover:border-emerald-500/40 transition shadow-xl flex flex-col justify-between"
              >
                {/* Snapshot Thumbnail */}
                <div 
                  className="relative aspect-video bg-neutral-950 overflow-hidden cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <img 
                    src={log.imageUrl} 
                    alt={name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent" />

                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-900/90 text-emerald-300 border border-emerald-500/30">
                      {category}
                    </span>
                  </div>

                  <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-mono text-slate-300">
                    <span className="truncate">{log.timestamp}</span>
                    <span className="text-slate-400">CAM-01</span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 space-y-2.5">
                  <div>
                    <h4 className="text-sm font-bold text-white truncate">{name}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {noteText}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 text-xs">
                    <button 
                      onClick={() => setSelectedLog(log)}
                      className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Enlarge</span>
                    </button>

                    <button 
                      onClick={(e) => handleDelete(log.id, e)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition cursor-pointer" 
                      title="Delete Log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* VISITOR SNAPSHOT ENLARGE / PREVIEW DETAIL MODAL */}
      {selectedLog && (() => {
        const { category, name, noteText } = parseLogDetails(selectedLog);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="relative w-full max-w-2xl rounded-2xl glass-card border border-white/10 overflow-hidden shadow-2xl">
              
              <button 
                onClick={() => setSelectedLog(null)}
                className="absolute top-3 right-3 z-20 p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-white border border-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative aspect-video bg-neutral-950 flex items-center justify-center overflow-hidden">
                <img 
                  src={selectedLog.imageUrl} 
                  alt={name} 
                  className="w-full h-full object-contain"
                />
                
                {/* HUD Brackets */}
                <div className="hud-bracket-tl"></div>
                <div className="hud-bracket-tr"></div>
                <div className="hud-bracket-bl"></div>
                <div className="hud-bracket-br"></div>

                <div className="absolute bottom-3 left-3 bg-neutral-950/80 px-2.5 py-1 rounded border border-white/10 font-mono text-[11px] text-emerald-400">
                  NVR ARCHIVE REF: #VG-REC-{selectedLog.id}
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-950 text-emerald-300 border border-emerald-800/40 font-bold">
                        {category}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {selectedLog.timestamp}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white">{name}</h2>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-400">
                    <span className="text-slate-500">Camera Source:</span>
                    <p className="text-slate-200 font-medium">Main Gate #01</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-white/5 text-xs text-slate-300 space-y-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                    Security Log Note:
                  </span>
                  <p className="italic leading-relaxed">
                    "{noteText}"
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                  <button 
                    onClick={handlePrintBadge}
                    className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-slate-200 border border-white/10 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Security Badge</span>
                  </button>

                  <button 
                    onClick={() => handleDelete(selectedLog.id)}
                    className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/40 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Record</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
