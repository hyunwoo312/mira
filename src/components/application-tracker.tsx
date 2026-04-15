import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, ArrowRight, Trash2, MapPin, Download, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  loadApplications,
  deleteApplication,
  clearApplications,
  getWeeklyStats,
  getATSBreakdown,
  getMonthlyCount,
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

const ATS_BAR_COLORS: Record<string, string> = {
  greenhouse: 'bg-green-500',
  lever: 'bg-blue-500',
  ashby: 'bg-purple-500',
  workday: 'bg-orange-500',
  generic: 'bg-foreground/20',
};

type DateFilter = 'all' | 'week' | 'month';

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
  const [search, setSearch] = useState('');
  const [atsFilter, setAtsFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

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

  // Stats
  const [now] = useState(() => Date.now());
  const thisWeek = useMemo(
    () => entries.filter((e) => now - e.timestamp < 7 * 24 * 60 * 60 * 1000).length,
    [entries, now],
  );
  const thisMonth = useMemo(() => getMonthlyCount(entries), [entries]);
  const avgFillRate = useMemo(
    () =>
      entries.length > 0
        ? Math.round(
            (entries.reduce((sum, e) => sum + (e.total > 0 ? e.filled / e.total : 0), 0) /
              entries.length) *
              100,
          )
        : 0,
    [entries],
  );
  const weeklyStats = useMemo(() => getWeeklyStats(entries), [entries]);
  const atsBreakdown = useMemo(() => getATSBreakdown(entries), [entries]);

  // Filtering
  const filtered = useMemo(() => {
    let result = entries;

    if (dateFilter === 'week') {
      result = result.filter((e) => now - e.timestamp < 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'month') {
      result = result.filter((e) => now - e.timestamp < 30 * 24 * 60 * 60 * 1000);
    }

    if (atsFilter) {
      result = result.filter((e) => e.ats === atsFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.company.toLowerCase().includes(q) ||
          e.role.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q),
      );
    }

    return result;
  }, [entries, search, atsFilter, dateFilter, now]);

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

      {entries.length > 0 ? (
        <>
          {/* Stats row */}
          <motion.div className="mx-6 mb-3 flex gap-2" variants={fadeUp}>
            {[
              { label: 'Total', value: String(entries.length) },
              { label: 'This week', value: String(thisWeek) },
              { label: 'This month', value: String(thisMonth) },
              { label: 'Avg fill', value: `${avgFillRate}%` },
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

          {/* Weekly trend */}
          <motion.div className="mx-6 mb-3" variants={fadeUp}>
            <WeeklyChart data={weeklyStats} />
          </motion.div>

          {/* ATS breakdown */}
          {atsBreakdown.length > 1 && (
            <motion.div className="mx-6 mb-3" variants={fadeUp}>
              <ATSBar breakdown={atsBreakdown} total={entries.length} />
            </motion.div>
          )}

          {/* Divider */}
          <motion.div className="mx-6 h-px bg-foreground/[0.06] mb-2" variants={fadeUp} />

          {/* Search + filters */}
          <motion.div className="px-6 pb-2 space-y-2" variants={fadeUp}>
            {/* Search bar */}
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/25"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company, role, location..."
                className="w-full pl-7 pr-7 py-1.5 rounded-md bg-foreground/[0.03] border border-foreground/[0.06] text-[11px] text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/15 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/25 hover:text-foreground/50 cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Date chips */}
              {(['all', 'week', 'month'] as DateFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setDateFilter(f)}
                  className={cn(
                    'text-[9px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider transition-colors cursor-pointer',
                    dateFilter === f
                      ? 'bg-primary/10 text-primary'
                      : 'bg-foreground/[0.03] text-foreground/30 hover:text-foreground/50',
                  )}
                >
                  {f === 'all' ? 'All time' : f === 'week' ? 'This week' : 'This month'}
                </button>
              ))}

              {/* ATS chips */}
              {atsBreakdown.map(({ ats }) => (
                <button
                  key={ats}
                  type="button"
                  onClick={() => setAtsFilter(atsFilter === ats ? null : ats)}
                  className={cn(
                    'text-[9px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider transition-colors cursor-pointer',
                    atsFilter === ats
                      ? (ATS_COLORS[ats] ?? ATS_COLORS.generic)
                      : 'bg-foreground/[0.03] text-foreground/30 hover:text-foreground/50',
                  )}
                >
                  {ats}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Entry list */}
          <motion.div className="flex-1 overflow-y-auto px-4 pb-20" variants={stagger}>
            {filtered.length > 0 ? (
              filtered.map((entry) => (
                <motion.div
                  key={entry.id}
                  variants={fadeUp}
                  className="group px-2 py-2.5 rounded-lg hover:bg-foreground/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 min-w-0">
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] font-semibold text-foreground hover:text-primary truncate block transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {entry.role || 'Unknown Role'}
                      </a>
                      <div className="text-[11px] text-foreground/50 truncate">
                        {entry.company || 'Unknown Company'}
                      </div>
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
              ))
            ) : (
              <div className="text-center py-8 text-[11px] text-foreground/25">
                No matching applications
              </div>
            )}
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

/* ── Weekly sparkline chart ── */
function WeeklyChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="pt-2">
      <div className="flex items-end gap-1" style={{ height: 48 }}>
        {data.map((d, i) => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <motion.div
              className="w-full rounded-sm bg-primary/20"
              initial={{ height: 0 }}
              animate={{ height: `${Math.max((d.count / max) * 36, d.count > 0 ? 4 : 0)}px` }}
              transition={{ duration: 0.4, delay: i * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
            />
            <span className="text-[8px] text-foreground/25 leading-none">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── ATS breakdown bar ── */
function ATSBar({
  breakdown,
  total,
}: {
  breakdown: { ats: string; count: number }[];
  total: number;
}) {
  return (
    <div>
      <div className="flex h-[6px] rounded-full overflow-hidden bg-foreground/[0.04]">
        {breakdown.map((b, i) => (
          <motion.div
            key={b.ats}
            className={cn('h-full', ATS_BAR_COLORS[b.ats] ?? 'bg-foreground/15')}
            initial={{ width: 0 }}
            animate={{ width: `${(b.count / total) * 100}%` }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        {breakdown.map((b) => (
          <div key={b.ats} className="flex items-center gap-1">
            <div
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                ATS_BAR_COLORS[b.ats] ?? 'bg-foreground/15',
              )}
            />
            <span className="text-[8px] text-foreground/30 uppercase tracking-wider">{b.ats}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
