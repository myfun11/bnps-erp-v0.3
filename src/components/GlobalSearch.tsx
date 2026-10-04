import React, { useState, useEffect, useRef } from 'react';
import { erpStore } from '../services/erpStore';
import { Search, X, Users, UserPlus, Layers, ExternalLink, ArrowRight } from 'lucide-react';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEntity: (type: string, id: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, onSelectEntity }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReturnType<typeof erpStore.searchGlobal>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length > 1) {
      const res = erpStore.searchGlobal(query);
      setResults(res);
    } else {
      setResults([]);
    }
  }, [query]);

  // Keyboard shortcut listener for escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-900/90 gap-3">
          <Search className="w-5 h-5 text-amber-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Customer Code, Mobile, Consumer No, Lead Code, Agent Code..."
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs font-mono rounded bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
          >
            ESC
          </button>
        </div>

        {/* Results Body */}
        <div className="overflow-y-auto p-2 divide-y divide-slate-800/60 flex-1">
          {query.trim().length <= 1 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              <Search className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              Type at least 2 characters to search across Customer Masters, Leads, and Agents.
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No matching records found for "{query}".
            </div>
          ) : (
            results.map((item) => {
              const isCust = item.type === 'customer';
              const isLead = item.type === 'lead';
              const isAgent = item.type === 'agent';

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    onSelectEntity(item.type, item.id);
                    onClose();
                  }}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isCust ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      isLead ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    }`}>
                      {isCust && <Users className="w-4 h-4" />}
                      {isLead && <UserPlus className="w-4 h-4" />}
                      {isAgent && <Layers className="w-4 h-4" />}
                      {item.type === 'pmsg' && <ExternalLink className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-200 group-hover:text-amber-400 transition-colors">
                        {item.primary}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {item.secondary}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {item.badge}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Fast Server-side Indexing • No Google Sheets Latency</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
};
