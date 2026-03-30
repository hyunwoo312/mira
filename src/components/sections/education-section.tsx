import { useState, useMemo } from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { MonthPicker } from '@/components/ui/month-picker';
import { LedgerRow, LedgerInput } from '@/components/ui/ledger-row';
import { Plus, X, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Profile, EducationEntry } from '@/lib/schema';

const DEGREE_OPTIONS = [
  'High School',
  "Associate's",
  "Bachelor's",
  "Master's",
  'Doctorate',
  'Other',
];

function sortKey(e: EducationEntry): number {
  return (e.startYear ?? 0) * 12 + (e.startMonth ?? 0);
}

function EduItem({
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
  const entry = watch(`education.${index}`);
  const school = entry?.school || 'Untitled';
  const degree = entry?.degree || '';
  const field = entry?.fieldOfStudy || '';
  const subtitle = [degree, field].filter(Boolean).join(' · ') || 'No details';
  const [hovered, setHovered] = useState(false);

  const startMonth = watch(`education.${index}.startMonth`);
  const startYear = watch(`education.${index}.startYear`);
  const gradMonth = watch(`education.${index}.gradMonth`);
  const gradYear = watch(`education.${index}.gradYear`);

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
            School
          </div>
          <div className="font-medium text-lg tracking-tight leading-tight">{school}</div>
          <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>
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
              <LedgerRow label="School">
                <LedgerInput
                  placeholder="University of California"
                  aria-label="School"
                  {...register(`education.${index}.school`)}
                />
              </LedgerRow>
              <LedgerRow label="Degree">
                <Controller
                  name={`education.${index}.degree`}
                  control={control}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger className="w-auto h-auto border-0 border-b-0 px-0 py-0 text-sm text-right justify-end">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DEGREE_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </LedgerRow>
              <LedgerRow label="Field of Study">
                <LedgerInput
                  placeholder="Computer Science"
                  aria-label="Field of Study"
                  {...register(`education.${index}.fieldOfStudy`)}
                />
              </LedgerRow>
              <LedgerRow label="Minor">
                <LedgerInput
                  placeholder="Optional"
                  aria-label="Minor"
                  {...register(`education.${index}.minor`)}
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
                    setValue(`education.${index}.startMonth`, v.month);
                    setValue(`education.${index}.startYear`, v.year);
                  }}
                  placeholder="Select..."
                  alignRight
                  bare
                />
              </LedgerRow>
              <LedgerRow label="Graduation">
                <MonthPicker
                  value={
                    gradMonth != null && gradYear != null
                      ? { month: gradMonth, year: gradYear }
                      : null
                  }
                  onChange={(v) => {
                    setValue(`education.${index}.gradMonth`, v.month);
                    setValue(`education.${index}.gradYear`, v.year);
                  }}
                  placeholder="Select..."
                  alignRight
                  bare
                />
              </LedgerRow>
              <LedgerRow label="GPA">
                <LedgerInput
                  placeholder="3.8"
                  aria-label="GPA"
                  className="w-20"
                  {...register(`education.${index}.gpa`)}
                />
              </LedgerRow>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function EducationSection() {
  const { control, watch } = useFormContext<Profile>();
  const { fields, append, remove } = useFieldArray({ control, name: 'education' });
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const rawEntries = watch('education');
  const sortedIndices = useMemo(() => {
    const entries = rawEntries ?? [];
    return entries
      .map((e, i) => ({ entry: e, index: i }))
      .sort((a, b) => sortKey(b.entry) - sortKey(a.entry))
      .map((x) => x.index);
  }, [rawEntries]);

  const handleAdd = () => {
    append({ school: '', degree: '', fieldOfStudy: '', minor: '', gpa: '' });
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
        aria-label="Add education"
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
            Your first entry fills School, Degree, and Graduation Date on applications.
          </motion.p>
        )}
      </AnimatePresence>

      {sortedIndices.map((originalIndex, displayIndex) => {
        const field = fields[originalIndex]!;
        return (
          <EduItem
            key={field.id}
            index={originalIndex}
            num={String(displayIndex + 1).padStart(2, '0')}
            isFirst={displayIndex === 0}
            isExpanded={expandedIndex === originalIndex}
            onToggle={() => handleToggle(originalIndex)}
            onRemove={() => {
              if (expandedIndex === originalIndex) setExpandedIndex(null);
              remove(originalIndex);
            }}
          />
        );
      })}
    </div>
  );
}
