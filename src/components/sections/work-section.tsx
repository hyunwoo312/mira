import { useState, useMemo } from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { MonthPicker } from '@/components/ui/month-picker';
import { LedgerRow, LedgerInput } from '@/components/ui/ledger-row';
import { Plus, X, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import type { Profile, WorkEntry } from '@/lib/schema';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(month?: number, year?: number) {
  if (!month && !year) return '';
  if (month && year) return `${MONTHS[month - 1]} ${year}`;
  if (year) return `${year}`;
  return '';
}

function sortKey(e: WorkEntry): number {
  return (e.startYear ?? 0) * 12 + (e.startMonth ?? 0);
}

function WorkEntryItem({
  index,
  num,
  isFirst,
  isExpanded,
  onToggle,
  onRemove,
}: {
  index: number;
  num: string;
  isFirst: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { watch, register, control, setValue } = useFormContext<Profile>();
  const entry = watch(`workExperience.${index}`);
  const title = entry?.title || 'Untitled';
  const company = entry?.company || '';
  const start = formatDate(entry?.startMonth, entry?.startYear);
  const end = entry?.current ? 'Present' : formatDate(entry?.endMonth, entry?.endYear);
  const dateStr = start ? `${start} - ${end || '?'}` : '';
  const subtitle = [company, dateStr].filter(Boolean).join(' · ');
  const isCurrent = watch(`workExperience.${index}.current`);
  const [hovered, setHovered] = useState(false);

  const startMonth = watch(`workExperience.${index}.startMonth`);
  const startYear = watch(`workExperience.${index}.startYear`);
  const endMonth = watch(`workExperience.${index}.endMonth`);
  const endYear = watch(`workExperience.${index}.endYear`);

  return (
    <div
      className={`mb-6 ${!isExpanded && !isFirst ? 'opacity-70 hover:opacity-100' : ''} transition-opacity`}
    >
      <div
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex justify-between items-end pb-2 border-b cursor-pointer transition-all duration-200 ${
          isExpanded || isFirst
            ? 'border-foreground'
            : 'border-border hover:border-foreground hover:translate-x-0.5'
        }`}
      >
        <div>
          <div className="text-[10px] uppercase tracking-[0.05em] font-medium text-muted-foreground mb-1">
            Role
          </div>
          <div className="font-medium text-lg tracking-tight leading-tight">{title}</div>
          {subtitle && <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
        <div className="flex items-start gap-1 text-2xl font-light leading-none tracking-tighter text-muted-foreground/40 shrink-0">
          <AnimatePresence mode="wait">
            {hovered && !isExpanded ? (
              <motion.button
                key="del"
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.12 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Delete"
              >
                <X size={16} />
              </motion.button>
            ) : (
              <motion.span
                key="num"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.12 }}
                className="flex items-start gap-0.5"
              >
                <ArrowUpRight size={14} className="mt-1.5" />
                {num}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Expanded detail — matches reference: left border, compact fields */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-3 border-l border-border ml-2 mt-3 space-y-0">
              <LedgerRow label="Company">
                <LedgerInput
                  placeholder="Acme Corp"
                  aria-label="Company"
                  {...register(`workExperience.${index}.company`)}
                />
              </LedgerRow>
              <LedgerRow label="Job Title">
                <LedgerInput
                  placeholder="Software Engineer"
                  aria-label="Job Title"
                  {...register(`workExperience.${index}.title`)}
                />
              </LedgerRow>
              <LedgerRow label="Start Date">
                <MonthPicker
                  value={
                    startMonth != null && startYear != null
                      ? { month: startMonth, year: startYear }
                      : null
                  }
                  onChange={(v) => {
                    setValue(`workExperience.${index}.startMonth`, v.month);
                    setValue(`workExperience.${index}.startYear`, v.year);
                  }}
                  placeholder="Select..."
                  alignRight
                  bare
                />
              </LedgerRow>
              <div className={isCurrent ? 'opacity-40 pointer-events-none' : ''}>
                <LedgerRow label="End Date">
                  <MonthPicker
                    value={
                      endMonth != null && endYear != null
                        ? { month: endMonth, year: endYear }
                        : null
                    }
                    onChange={(v) => {
                      setValue(`workExperience.${index}.endMonth`, v.month);
                      setValue(`workExperience.${index}.endYear`, v.year);
                    }}
                    placeholder="Select..."
                    alignRight
                    bare
                  />
                </LedgerRow>
              </div>
              <LedgerRow label="Currently Here">
                <Controller
                  name={`workExperience.${index}.current`}
                  control={control}
                  render={({ field: f }) => (
                    <Switch checked={f.value} onCheckedChange={f.onChange} />
                  )}
                />
              </LedgerRow>
              <LedgerRow label="Description" column>
                <Textarea
                  placeholder="Briefly describe your responsibilities..."
                  className="text-sm resize-none"
                  {...register(`workExperience.${index}.description`)}
                />
              </LedgerRow>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getOverlaps(entries: WorkEntry[]): [number, number][] {
  const overlaps: [number, number][] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!,
        b = entries[j]!;
      if (a.startYear == null || b.startYear == null) continue;
      const s1 = a.startYear * 12 + (a.startMonth ?? 1),
        s2 = b.startYear * 12 + (b.startMonth ?? 1);
      const now = new Date(),
        nowVal = now.getFullYear() * 12 + (now.getMonth() + 1);
      const e1 = a.current ? nowVal : a.endYear != null ? a.endYear * 12 + (a.endMonth ?? 12) : s1;
      const e2 = b.current ? nowVal : b.endYear != null ? b.endYear * 12 + (b.endMonth ?? 12) : s2;
      if (s1 < e2 && s2 < e1) overlaps.push([i, j]);
    }
  }
  return overlaps;
}

export function WorkSection() {
  const { control, watch } = useFormContext<Profile>();
  const { fields, append, remove } = useFieldArray({ control, name: 'workExperience' });
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const rawEntries = watch('workExperience');

  // Build a key from all date fields so sorting recomputes when any date changes
  const dateKey = (rawEntries ?? [])
    .map(
      (e) =>
        `${e.startYear ?? 0}-${e.startMonth ?? 0}-${e.endYear ?? 0}-${e.endMonth ?? 0}-${e.current ? 1 : 0}`,
    )
    .join('|');

  const sortedIndices = useMemo(() => {
    const entries = rawEntries ?? [];
    return entries
      .map((e, i) => ({ entry: e, index: i }))
      .sort((a, b) => sortKey(b.entry) - sortKey(a.entry))
      .map((x) => x.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  const handleAdd = () => {
    const hasCurrent = (rawEntries ?? []).some((e) => e.current);
    append({ company: '', title: '', current: !hasCurrent, description: '' });
    setExpandedIndex(fields.length);
  };

  const handleToggle = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleAdd}
        className="absolute -top-[52px] right-0 w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-all cursor-pointer"
        aria-label="Add experience"
      >
        <Plus size={16} />
      </button>

      <AnimatePresence mode="wait">
        {fields.length === 0 && (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[11px] text-muted-foreground/50 leading-relaxed py-1"
          >
            Your most recent role fills "Current Company" and "Job Title" on applications.
          </motion.p>
        )}
      </AnimatePresence>

      <LayoutGroup>
        {sortedIndices.map((originalIndex, displayIndex) => {
          const field = fields[originalIndex]!;
          const num = String(displayIndex + 1).padStart(2, '0');
          return (
            <motion.div
              key={field.id}
              layout
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <WorkEntryItem
                index={originalIndex}
                num={num}
                isFirst={displayIndex === 0}
                isExpanded={expandedIndex === originalIndex}
                onToggle={() => handleToggle(originalIndex)}
                onRemove={() => {
                  if (expandedIndex === originalIndex) setExpandedIndex(null);
                  remove(originalIndex);
                }}
              />
            </motion.div>
          );
        })}
      </LayoutGroup>

      {(() => {
        const overlaps = getOverlaps(rawEntries ?? []);
        return overlaps.length > 0 ? (
          <div className="space-y-1 mt-2">
            {overlaps.map(([i, j]) => {
              const a = rawEntries?.[i];
              const b = rawEntries?.[j];
              const aName = a?.company || a?.title || 'Role ' + (i + 1);
              const bName = b?.company || b?.title || 'Role ' + (j + 1);
              const aRange = `${formatDate(a?.startMonth, a?.startYear)} – ${a?.current ? 'Present' : formatDate(a?.endMonth, a?.endYear) || '?'}`;
              const bRange = `${formatDate(b?.startMonth, b?.startYear)} – ${b?.current ? 'Present' : formatDate(b?.endMonth, b?.endYear) || '?'}`;
              return (
                <div
                  key={`o-${i}-${j}`}
                  className="flex items-start gap-2 px-3 py-2 bg-yellow-500/5 border border-yellow-500/15 text-yellow-600 dark:text-yellow-400 rounded-sm"
                >
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-relaxed">
                    <strong>{aName}</strong> ({aRange}) overlaps with <strong>{bName}</strong> (
                    {bRange})
                  </span>
                </div>
              );
            })}
          </div>
        ) : null;
      })()}
    </div>
  );
}
