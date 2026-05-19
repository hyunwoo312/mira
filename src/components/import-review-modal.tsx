import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, FileText, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/schema';
import { detectConflicts, isMeaningfulValue } from '@/lib/import/commit';
import type { ImportMode, ImportPayload } from '@/lib/import/types';
import { useFocusTrap } from '@/hooks/use-focus-trap';

const EASE = [0.25, 0.1, 0.25, 1] as const;

const MODE_OPTIONS: { value: ImportMode; label: string; desc: string }[] = [
  {
    value: 'overwrite-all',
    label: 'Overwrite all',
    desc: 'Replace existing values with parsed ones.',
  },
  {
    value: 'skip-conflicts',
    label: 'Skip conflicts',
    desc: 'Only fill fields that are currently empty.',
  },
  {
    value: 'skip-all',
    label: 'Attach only',
    desc: "Don't change profile fields — just save the file as your resume.",
  },
];

type FieldKey = keyof Profile;

type FieldGroup = {
  id: string;
  label: string;
  scalarFields: { key: FieldKey; label: string }[];
  arrayFields: { key: FieldKey; label: string }[];
};

const FIELD_GROUPS: FieldGroup[] = [
  {
    id: 'personal',
    label: 'Personal',
    scalarFields: [
      { key: 'firstName', label: 'First name' },
      { key: 'lastName', label: 'Last name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'address1', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'zipCode', label: 'Zip code' },
      { key: 'country', label: 'Country' },
    ],
    arrayFields: [],
  },
  {
    id: 'links',
    label: 'Links',
    scalarFields: [
      { key: 'linkedin', label: 'LinkedIn' },
      { key: 'github', label: 'GitHub' },
      { key: 'portfolio', label: 'Portfolio' },
      { key: 'twitter', label: 'Twitter' },
    ],
    arrayFields: [],
  },
  {
    id: 'experience',
    label: 'Experience',
    scalarFields: [],
    arrayFields: [{ key: 'workExperience', label: 'Work entries' }],
  },
  {
    id: 'education',
    label: 'Education',
    scalarFields: [],
    arrayFields: [{ key: 'education', label: 'Education entries' }],
  },
  {
    id: 'skills',
    label: 'Skills',
    scalarFields: [],
    arrayFields: [
      { key: 'skills', label: 'Skills' },
      { key: 'certifications', label: 'Certifications' },
      { key: 'languages', label: 'Languages' },
    ],
  },
];

const KEY_FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
];

export type CommitArgs = {
  mode: ImportMode;
  target: { kind: 'existing'; presetId: string };
};

interface ImportReviewModalProps {
  open: boolean;
  onClose: () => void;
  payload: ImportPayload | null;
  currentProfile: Profile;
  activePresetId: string;
  onCommit: (args: CommitArgs) => Promise<void> | void;
}

export function ImportReviewModal({
  open,
  onClose,
  payload,
  currentProfile,
  activePresetId,
  onCommit,
}: ImportReviewModalProps) {
  const [mode, setMode] = useState<ImportMode>('skip-conflicts');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useFocusTrap(dialogRef, open);

  // Reset on open
  useEffect(() => {
    if (open) {
      setMode('skip-conflicts');
      setError(null);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, submitting]);

  // Initial focus
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  const conflictInfo = useMemo(() => {
    if (!payload) return { conflicts: new Set<FieldKey>(), toApply: new Set<FieldKey>() };
    return detectConflicts(currentProfile, payload.fields);
  }, [currentProfile, payload]);

  const counts = useMemo(() => {
    if (!payload) return { applied: 0, skipped: 0, conflicts: 0 };
    const total = conflictInfo.toApply.size;
    const conflicts = conflictInfo.conflicts.size;
    if (mode === 'skip-all') return { applied: 0, skipped: total, conflicts: 0 };
    if (mode === 'skip-conflicts') {
      return { applied: total - conflicts, skipped: conflicts, conflicts: 0 };
    }
    return { applied: total, skipped: 0, conflicts };
  }, [payload, conflictInfo, mode]);

  const parsedSections = useMemo(() => {
    if (!payload) return [];
    return FIELD_GROUPS.map((group) => {
      const scalarCount = group.scalarFields.filter((field) =>
        isMeaningfulValue(payload.fields[field.key]),
      ).length;
      const arrayCount = group.arrayFields.filter((field) => {
        const value = payload.fields[field.key];
        return Array.isArray(value) && value.length > 0;
      }).length;
      return { id: group.id, label: group.label, count: scalarCount + arrayCount };
    }).filter((section) => section.count > 0);
  }, [payload]);

  const missingKeyFields = useMemo(() => {
    if (!payload) return [];
    return KEY_FIELDS.filter((field) => !isMeaningfulValue(payload.fields[field.key]));
  }, [payload]);

  const handleSave = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onCommit({ mode, target: { kind: 'existing', presetId: activePresetId } });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong saving the import.');
    } finally {
      setSubmitting(false);
    }
  };

  const modal = (
    <AnimatePresence>
      {open && payload && (
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.15, ease: EASE }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => !submitting && onClose()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-review-title"
        >
          <motion.div
            ref={dialogRef}
            initial={reduce ? false : { opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: EASE }}
            className="bg-popover border border-border rounded-lg p-5 mx-4 w-full max-w-[420px] shadow-md max-h-[60vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <Header
              fileName={payload.fileName}
              fieldCount={conflictInfo.toApply.size}
              onClose={onClose}
              closeRef={closeRef}
            />

            <div className="space-y-4 shrink-0">
              <PrivacyNote />
              <ImportCoverage sections={parsedSections} missing={missingKeyFields} />

              <Section title="Conflict resolution">
                <ModePicker mode={mode} onChange={setMode} />
              </Section>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 mt-4 min-h-0">
              {conflictInfo.toApply.size > 0 ? (
                <Section title="Preview">
                  <FieldsPreview
                    payload={payload}
                    currentProfile={currentProfile}
                    conflicts={conflictInfo.conflicts}
                    mode={mode}
                  />
                </Section>
              ) : (
                <div className="text-[11px] text-foreground/50 italic px-1">
                  No profile fields were found in this resume. The file will still be saved.
                </div>
              )}
            </div>

            <Footer
              counts={counts}
              error={error}
              submitting={submitting}
              onCancel={onClose}
              onSave={handleSave}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}

function ImportCoverage({
  sections,
  missing,
}: {
  sections: { id: string; label: string; count: number }[];
  missing: { key: FieldKey; label: string }[];
}) {
  return (
    <div className="space-y-2">
      {sections.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {sections.slice(0, 6).map((section) => (
            <div
              key={section.id}
              className="rounded-md bg-foreground/[0.03] border border-foreground/[0.06] px-2 py-1.5"
            >
              <div className="text-[11px] font-semibold text-foreground/70 tabular-nums">
                {section.count}
              </div>
              <div className="text-[8px] uppercase tracking-[0.08em] text-foreground/35 truncate">
                {section.label}
              </div>
            </div>
          ))}
        </div>
      )}
      {missing.length > 0 && (
        <div className="rounded-md border border-amber-500/15 bg-amber-500/5 px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400">
            Missing key fields
          </div>
          <div className="mt-1 text-[10px] leading-relaxed text-foreground/50">
            {missing.map((field) => field.label).join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}

function Header({
  fileName,
  fieldCount,
  onClose,
  closeRef,
}: {
  fileName: string;
  fieldCount: number;
  onClose: () => void;
  closeRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
          <FileText size={16} className="text-primary" />
        </div>
        <div className="min-w-0">
          <h3 id="import-review-title" className="text-sm font-medium text-foreground leading-none">
            Review import
          </h3>
          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground/60 leading-none truncate">
            {fileName} · {fieldCount} field{fieldCount === 1 ? '' : 's'} found
          </p>
        </div>
      </div>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="text-foreground/40 hover:text-foreground/70 transition-colors cursor-pointer pt-1 shrink-0"
        aria-label="Close import review"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function PrivacyNote() {
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 px-2 py-1.5 rounded-md bg-muted/40">
      <Lock size={11} aria-hidden />
      <span>Files are parsed on your device. Nothing is uploaded.</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/50 mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function ModePicker({ mode, onChange }: { mode: ImportMode; onChange: (m: ImportMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Conflict resolution mode" className="space-y-1.5">
      {MODE_OPTIONS.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-md border transition-colors cursor-pointer',
              active ? 'border-primary/60 bg-primary/5' : 'border-border hover:bg-foreground/5',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full border shrink-0 transition-colors',
                active ? 'border-primary' : 'border-foreground/30',
              )}
            >
              {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-medium text-foreground/85">{opt.label}</span>
              <span className="block text-[10px] text-foreground/50 mt-0.5 leading-snug">
                {opt.desc}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FieldsPreview({
  payload,
  currentProfile,
  conflicts,
  mode,
}: {
  payload: ImportPayload;
  currentProfile: Profile;
  conflicts: Set<FieldKey>;
  mode: ImportMode;
}) {
  const dimmed = mode === 'skip-all';

  return (
    <div className={cn('space-y-2.5 transition-opacity', dimmed && 'opacity-40')}>
      {FIELD_GROUPS.map((group) => {
        const visibleScalars = group.scalarFields.filter((f) =>
          isMeaningfulValue(payload.fields[f.key]),
        );
        const visibleArrays = group.arrayFields.filter((f) => {
          const v = payload.fields[f.key];
          return Array.isArray(v) && v.length > 0;
        });
        if (visibleScalars.length === 0 && visibleArrays.length === 0) return null;

        return (
          <div key={group.id} className="rounded-md border border-border/70">
            <div className="px-3 py-1.5 bg-muted/30 border-b border-border/70">
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-foreground/55">
                {group.label}
              </span>
            </div>
            <ul className="divide-y divide-border/50">
              {visibleScalars.map((f) => (
                <FieldRow
                  key={f.key as string}
                  label={f.label}
                  parsedValue={String(payload.fields[f.key] ?? '')}
                  existingValue={String(currentProfile[f.key] ?? '')}
                  isConflict={conflicts.has(f.key)}
                  willApply={
                    mode === 'overwrite-all' || (mode === 'skip-conflicts' && !conflicts.has(f.key))
                  }
                />
              ))}
              {visibleArrays.map((f) => {
                const arr = payload.fields[f.key] as unknown[];
                const existingArr = currentProfile[f.key] as unknown[];
                const isConflict = conflicts.has(f.key);
                return (
                  <ArrayRow
                    key={f.key as string}
                    label={f.label}
                    parsedCount={arr.length}
                    existingCount={Array.isArray(existingArr) ? existingArr.length : 0}
                    isConflict={isConflict}
                    willApply={
                      mode === 'overwrite-all' || (mode === 'skip-conflicts' && !isConflict)
                    }
                  />
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function FieldRow({
  label,
  parsedValue,
  existingValue,
  isConflict,
  willApply,
}: {
  label: string;
  parsedValue: string;
  existingValue: string;
  isConflict: boolean;
  willApply: boolean;
}) {
  return (
    <li className="flex items-start gap-3 px-3 py-2 text-[11px]">
      <span className="text-foreground/55 w-[78px] shrink-0">{label}</span>
      <div className="flex-1 min-w-0">
        {isConflict && existingValue && (
          <span className="block text-foreground/30 line-through truncate">{existingValue}</span>
        )}
        <span
          className={cn('block truncate', willApply ? 'text-foreground' : 'text-foreground/40')}
        >
          {parsedValue}
        </span>
      </div>
    </li>
  );
}

function ArrayRow({
  label,
  parsedCount,
  existingCount,
  isConflict,
  willApply,
}: {
  label: string;
  parsedCount: number;
  existingCount: number;
  isConflict: boolean;
  willApply: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-[11px]">
      <span className="text-foreground/55 w-[78px] shrink-0">{label}</span>
      <div className="flex-1 min-w-0 flex items-baseline gap-2">
        <span className={cn(willApply ? 'text-foreground' : 'text-foreground/40')}>
          {parsedCount} new
        </span>
        {isConflict && (
          <span className="text-foreground/35 line-through">{existingCount} existing</span>
        )}
      </div>
    </li>
  );
}

function Footer({
  counts,
  error,
  submitting,
  onCancel,
  onSave,
}: {
  counts: { applied: number; skipped: number; conflicts: number };
  error: string | null;
  submitting: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="pt-4 mt-4 border-t border-border space-y-3">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.1em] text-foreground/55">
        <span>
          <span className="text-foreground font-semibold tabular-nums">{counts.applied}</span> to
          import
          {counts.conflicts > 0 && (
            <>
              {' · '}
              <span className="text-foreground font-semibold tabular-nums">
                {counts.conflicts}
              </span>{' '}
              conflicts
            </>
          )}
          {counts.skipped > 0 && (
            <>
              {' · '}
              <span className="text-foreground font-semibold tabular-nums">
                {counts.skipped}
              </span>{' '}
              skipped
            </>
          )}
        </span>
      </div>
      {error && (
        <div role="alert" className="text-[11px] text-destructive">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="h-8 px-3 rounded-lg text-[12px] font-medium text-foreground/60 hover:text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={submitting}
          className="h-8 px-3 rounded-lg text-[12px] font-medium text-primary-foreground bg-primary hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          {submitting ? 'Saving…' : 'Save to profile'}
        </button>
      </div>
    </div>
  );
}
