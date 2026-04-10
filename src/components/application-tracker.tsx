import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, ArrowRight, Trash2, MapPin, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  loadApplications,
  deleteApplication,
  clearApplications,
  type ApplicationEntry,
} from '@/lib/application-store';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const ATS_COLORS: Record<string, string> = {
  greenhouse: 'bg-green-500/10 text-green-600',
  lever: 'bg-blue-500/10 text-blue-600',
  ashby: 'bg-purple-500/10 text-purple-600',
  workday: 'bg-orange-500/10 text-orange-600',
  generic: 'bg-foreground/5 text-foreground/50',
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ApplicationTracker() {
  const [entries, setEntries] = useState<ApplicationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await loadApplications();
    setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadApplications().then((data) => {
      setEntries(data);
      setLoading(false);
    });
    // Refresh when storage changes (e.g., after a fill)
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('mira_applications' in changes) refresh();
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, [refresh]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteApplication(id);
      refresh();
    },
    [refresh],
  );

  const handleClearAll = useCallback(async () => {
    await clearApplications();
    refresh();
  }, [refresh]);

  const handleExport = useCallback(() => {
    if (entries.length === 0) return;
    const header = 'Date,Company,Role,Location,ATS,URL,Filled,Skipped,Failed,Total';
    const rows = entries.map((e) => {
      const date = new Date(e.timestamp).toISOString().slice(0, 10);
      const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
      return [
        date,
        escape(e.company),
        escape(e.role),
        escape(e.location),
        e.ats,
        escape(e.url),
        e.filled,
        e.skipped,
        e.failed,
        e.total,
      ].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mira-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const [now] = useState(() => Date.now());
  const thisWeek = entries.filter((e) => now - e.timestamp < 7 * 24 * 60 * 60 * 1000).length;
  const avgFillRate =
    entries.length > 0
      ? Math.round(
          (entries.reduce((sum, e) => sum + (e.total > 0 ? e.filled / e.total : 0), 0) /
            entries.length) *
            100,
        )
      : 0;

  if (loading) return null;

  return (
    <motion.div className="flex flex-col h-full" variants={stagger} initial="hidden" animate="show">
      {/* Header */}
      <motion.div className="px-6 pt-6 pb-3 flex items-start justify-between" variants={fadeUp}>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">
            Application Tracker
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground mt-0.5">
            Your <span className="text-primary">Applications.</span>
          </h2>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            className="mt-1.5 p-1.5 rounded-md hover:bg-foreground/[0.05] transition-colors cursor-pointer"
            title="Export as CSV"
          >
            <Download size={14} className="text-foreground/30 hover:text-foreground/60" />
          </button>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div className="mx-6 mb-4 flex gap-2" variants={fadeUp}>
        {[
          { label: 'Total', value: String(entries.length) },
          { label: 'This week', value: String(thisWeek) },
          { label: 'Avg fill', value: entries.length > 0 ? `${avgFillRate}%` : '—' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex-1 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06] px-3 py-2"
          >
            <div className="text-sm font-semibold text-foreground/70">{stat.value}</div>
            <div className="text-[9px] text-foreground/30 uppercase tracking-wider">
              {stat.label}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Divider */}
      <motion.div className="mx-6 h-px bg-foreground/[0.06] mb-2" variants={fadeUp} />

      {entries.length > 0 ? (
        <>
          {/* Entry list */}
          <motion.div className="flex-1 overflow-y-auto px-4 pb-20" variants={stagger}>
            {entries.map((entry) => (
              <motion.div
                key={entry.id}
                variants={fadeUp}
                className="group px-2 py-2.5 rounded-lg hover:bg-foreground/[0.03] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  {/* Left: text content */}
                  <div className="flex-1 min-w-0">
                    {/* Line 1: Job title (links to posting) */}
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] font-semibold text-foreground hover:text-primary truncate block transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {entry.role || 'Unknown Role'}
                    </a>

                    {/* Line 2: Company */}
                    <div className="text-[11px] text-foreground/50 truncate">
                      {entry.company || 'Unknown Company'}
                    </div>

                    {/* Line 3: Location · Date · ATS */}
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {entry.location && (
                        <>
                          <span className="flex items-center gap-0.5 text-[10px] text-foreground/30 truncate max-w-[140px]">
                            <MapPin size={9} className="shrink-0 text-foreground/25" />
                            {entry.location}
                          </span>
                          <span className="text-[10px] text-foreground/15">·</span>
                        </>
                      )}
                      <span className="text-[10px] text-foreground/30">
                        {formatDate(entry.timestamp)}
                      </span>
                      <span className="text-[10px] text-foreground/15">·</span>
                      <span
                        className={cn(
                          'text-[8px] px-1.5 py-px rounded-full font-medium uppercase tracking-wider',
                          ATS_COLORS[entry.ats] ?? ATS_COLORS.generic,
                        )}
                      >
                        {entry.ats}
                      </span>
                    </div>
                  </div>

                  {/* Right: fill rate + delete */}
                  <div className="shrink-0 self-center flex items-center gap-1">
                    <span className="text-[10px] text-foreground/30 tabular-nums">
                      {entry.filled}/{entry.total}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all cursor-pointer"
                    >
                      <Trash2 size={14} className="text-foreground/20 hover:text-destructive" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Clear all */}
          <motion.div className="px-6 py-3 border-t border-foreground/[0.06]" variants={fadeUp}>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] text-foreground/30 hover:text-destructive transition-colors cursor-pointer"
            >
              Clear all history
            </button>
          </motion.div>
        </>
      ) : (
        /* Empty state */
        <motion.div
          className="flex-1 flex flex-col items-center justify-center px-6 pb-20"
          variants={fadeUp}
        >
          <motion.div
            className="w-14 h-14 rounded-2xl bg-primary/[0.06] flex items-center justify-center mb-5"
            animate={{ rotate: [0, -3, 3, -1, 0] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
          >
            <Briefcase size={22} className="text-primary/30" strokeWidth={1.5} />
          </motion.div>
          <p className="text-[13px] font-medium text-foreground/50 mb-1.5">No applications yet</p>
          <p className="text-[11px] text-foreground/25 text-center leading-relaxed max-w-[220px] mb-5">
            Fill out a job application and it will automatically be tracked here.
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-primary/50 font-medium">
            <span>Fill your first application</span>
            <ArrowRight size={10} />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
