import { useState, useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Check } from 'lucide-react';
import type { Profile } from '@/lib/schema';

interface Props {
  lastSaved?: number;
}

const SECTIONS = [
  { label: 'Name', check: (p: Profile) => !!(p.firstName && p.lastName) },
  { label: 'Email', check: (p: Profile) => !!p.email },
  { label: 'Phone', check: (p: Profile) => !!p.phone },
  { label: 'Address', check: (p: Profile) => !!(p.city && p.state) },
  { label: 'Links', check: (p: Profile) => !!(p.linkedin || p.github || p.portfolio) },
  {
    label: 'Work',
    check: (p: Profile) => p.workExperience.length > 0 && !!p.workExperience[0]?.company,
  },
  { label: 'Education', check: (p: Profile) => p.education.length > 0 && !!p.education[0]?.school },
  { label: 'Skills', check: (p: Profile) => p.skills.length > 0 },
  {
    label: 'Preferences',
    check: (p: Profile) => !!(p.noticePeriod || p.workArrangement.length > 0),
  },
  { label: 'Documents', check: () => true },
];

const WATCHED_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'city',
  'state',
  'linkedin',
  'github',
  'portfolio',
  'workExperience',
  'education',
  'skills',
  'noticePeriod',
  'workArrangement',
] as const;

export function ProfileCompleteness({ lastSaved = 0 }: Props) {
  const { watch } = useFormContext<Profile>();
  const watched = watch(WATCHED_FIELDS as unknown as readonly (keyof Profile)[]);
  const profile = Object.fromEntries(
    WATCHED_FIELDS.map((k, i) => [k, watched[i]]),
  ) as unknown as Profile;

  const completed = SECTIONS.filter((s) => s.check(profile)).length;
  const total = SECTIONS.length;
  const pct = Math.round((completed / total) * 100);

  // Animated counter
  const motionPct = useMotionValue(0);
  const displayPct = useTransform(motionPct, (v) => `${Math.round(v)}%`);
  const pctRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const ctrl = animate(motionPct, pct, { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] });
    return () => ctrl.stop();
  }, [pct, motionPct]);
  useEffect(() => {
    return displayPct.on('change', (v) => {
      if (pctRef.current) pctRef.current.textContent = v;
    });
  }, [displayPct]);

  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    if (lastSaved <= 0) return;
    const show = setTimeout(() => setShowSaved(true), 0);
    const hide = setTimeout(() => setShowSaved(false), 1500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [lastSaved]);

  return (
    <div className="px-5 py-2.5 border-b border-border bg-background">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-muted-foreground font-medium">Profile</span>
        <div className="flex items-center gap-1.5">
          <AnimatePresence>
            {showSaved && (
              <motion.span
                initial={{ opacity: 0, x: 4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-[9px] text-muted-foreground/50 flex items-center gap-0.5"
              >
                <Check size={8} /> Saved
              </motion.span>
            )}
          </AnimatePresence>
          <span ref={pctRef} className="text-[10px] text-muted-foreground tabular-nums">
            {pct}%
          </span>
        </div>
      </div>
      <div className="h-1 w-full bg-border rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-foreground rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>
    </div>
  );
}
