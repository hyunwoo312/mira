import { useState, useCallback } from 'react';
import { FormProvider } from 'react-hook-form';
import { motion } from 'framer-motion';
import { PresetBar } from './preset-bar';
import { ProfileCompleteness } from './profile-completeness';
import { TabBar } from './tab-bar';
import { FillBar } from './fill-bar';
import { Section } from './section';
import { DeletePresetDialog } from './delete-preset-dialog';
import { ApplicationTracker } from './application-tracker';
import {
  PersonalSection,
  LinksSection,
  WorkSection,
  EducationSection,
  SkillsSection,
  PreferencesSection,
  EeoSection,
  DocumentsSection,
  AnswersSection,
} from './sections';
import { useScrollspy } from '@/hooks/use-scrollspy';
import { useProfile } from '@/hooks/use-profile';
import { useFill } from '@/hooks/use-fill';
import { useFiles } from '@/hooks/use-files';
import { PROFILE_SECTIONS } from '@/types/profile';
import { cn } from '@/lib/utils';
import type { SectionId } from '@/types/profile';
import type { FC } from 'react';

const sectionIds = PROFILE_SECTIONS.map((s) => s.id);

const SECTION_HEADINGS: Record<SectionId, { top: string; bold: string }> = {
  personal: { top: 'Personal', bold: 'Information.' },
  links: { top: 'Portfolio &', bold: 'Other Links.' },
  work: { top: 'Work', bold: 'Experience.' },
  education: { top: 'Your', bold: 'Education.' },
  skills: { top: 'Skills &', bold: 'Languages.' },
  preferences: { top: 'Work', bold: 'Preferences.' },
  eeo: { top: 'EEO &', bold: 'More.' },
  documents: { top: 'Resume &', bold: 'Documents.' },
  answers: { top: 'Custom', bold: 'Questions.' },
};

const SECTION_MAP: Record<SectionId, FC> = {
  personal: PersonalSection,
  links: LinksSection,
  work: WorkSection,
  education: EducationSection,
  skills: SkillsSection,
  preferences: PreferencesSection,
  eeo: EeoSection,
  documents: DocumentsSection,
  answers: AnswersSection,
};

const slideTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

export function Shell() {
  const { activeSection, containerRef, scrollToSection } = useScrollspy(sectionIds);
  const {
    form,
    isLoaded,
    lastSaved,
    presets,
    activePresetId,
    switchPreset,
    addNewPreset,
    removePreset,
    rename,
    saveNow,
    exportAllData,
    importData,
    deleteAllData,
  } = useProfile();
  const { isLoading, result, logs, pageUrl, fill } = useFill();
  const { files } = useFiles(activePresetId);

  const firstName = form.watch('firstName');
  const lastName = form.watch('lastName');
  const email = form.watch('email');
  const profileReady = !!(firstName?.trim() && lastName?.trim() && email?.trim());

  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  const [showTracker, setShowTracker] = useState(false);
  const [profileAnimKey, setProfileAnimKey] = useState(0);

  const toggleTracker = useCallback((show: boolean) => {
    setShowTracker(show);
    if (!show) setProfileAnimKey((k) => k + 1); // trigger re-entry animation
  }, []);

  const handleFill = useCallback(async () => {
    await saveNow();
    fill();
  }, [saveNow, fill]);

  if (!isLoaded) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-0 px-0"
        >
          {/* Preset bar skeleton */}
          <div className="px-4 py-3 border-b border-border">
            <div className="h-7 w-28 rounded-md bg-muted animate-pulse" />
          </div>

          {/* Completeness bar skeleton */}
          <div className="px-6 py-3">
            <div className="h-2 w-full rounded-full bg-muted animate-pulse" />
          </div>

          {/* Tab bar skeleton */}
          <div className="flex gap-2 px-6 pb-3 border-b border-border">
            {[48, 36, 56, 44, 40].map((w, i) => (
              <div
                key={i}
                className="h-6 rounded-md bg-muted animate-pulse"
                style={{ width: w, animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>

          {/* Section skeletons */}
          <div className="px-6 pt-6 space-y-8">
            {[0, 1, 2].map((s) => (
              <div key={s} className="space-y-3" style={{ animationDelay: `${s * 150}ms` }}>
                <div
                  className="h-4 w-32 rounded bg-muted animate-pulse"
                  style={{ animationDelay: `${s * 150}ms` }}
                />
                <div className="space-y-2">
                  {[1, 2, 3].map((r) => (
                    <div
                      key={r}
                      className="h-9 rounded-md bg-muted/60 animate-pulse"
                      style={{ animationDelay: `${(s * 3 + r) * 80}ms` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Fill bar skeleton */}
        <div className="mt-auto border-t border-border px-5 py-4">
          <div className="h-[46px] rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <div className="flex flex-col h-screen bg-background">
        {/* ── Profile view ── */}
        <div style={{ display: showTracker ? 'none' : 'contents' }}>
          {profileAnimKey > 0 ? (
            <>
              <motion.div
                key={`preset-${profileAnimKey}`}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...slideTransition, delay: 0 }}
              >
                <PresetBar
                  presets={presets}
                  activePresetId={activePresetId}
                  onSelect={switchPreset}
                  onAdd={addNewPreset}
                  onRequestDelete={setDeletePresetId}
                  onRename={rename}
                />
              </motion.div>
              <motion.div
                key={`comp-${profileAnimKey}`}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...slideTransition, delay: 0.03 }}
              >
                <ProfileCompleteness lastSaved={lastSaved} hasDocuments={files.length > 0} />
              </motion.div>
              <motion.div
                key={`tab-${profileAnimKey}`}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...slideTransition, delay: 0.06 }}
              >
                <TabBar activeSection={activeSection} onTabClick={scrollToSection} />
              </motion.div>
            </>
          ) : (
            <>
              <PresetBar
                presets={presets}
                activePresetId={activePresetId}
                onSelect={switchPreset}
                onAdd={addNewPreset}
                onRequestDelete={setDeletePresetId}
                onRename={rename}
              />
              <ProfileCompleteness lastSaved={lastSaved} hasDocuments={files.length > 0} />
              <TabBar activeSection={activeSection} onTabClick={scrollToSection} />
            </>
          )}
        </div>

        <div
          ref={containerRef}
          className={cn(
            'flex-1 overflow-y-auto scroll-area px-6 pt-4 pb-32',
            profileAnimKey > 0 && 'animate-slide-in-left',
          )}
          key={`scroll-${profileAnimKey}`}
          style={{ display: showTracker ? 'none' : undefined }}
        >
          {PROFILE_SECTIONS.map((section) => {
            const Component = SECTION_MAP[section.id];
            const heading = SECTION_HEADINGS[section.id];
            return (
              <Section
                key={section.id}
                id={section.id}
                title={heading.top}
                titleBold={heading.bold}
              >
                {section.id === 'documents' ? (
                  <DocumentsSection presetId={activePresetId} />
                ) : (
                  <Component />
                )}
              </Section>
            );
          })}
        </div>

        {/* ── Tracker view: shown when toggled ── */}
        {showTracker && (
          <motion.div
            className="flex-1 overflow-hidden"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={slideTransition}
          >
            <ApplicationTracker />
          </motion.div>
        )}

        {/* ── Bookmark tab: fixed to viewport, independent of scroll ── */}
        <motion.div
          className="fixed z-50"
          style={{ top: '50%', y: '-50%' }}
          animate={{
            right: showTracker ? 'auto' : 0,
            left: showTracker ? 0 : 'auto',
          }}
          transition={slideTransition}
          layout
        >
          <motion.button
            type="button"
            onClick={() => toggleTracker(!showTracker)}
            className={cn(
              'relative flex flex-col items-center justify-center',
              'w-[16px] h-[64px] cursor-pointer',
              'group',
            )}
            whileHover={{ width: 20 }}
            whileTap={{ scale: 0.92 }}
            layout
            aria-label={showTracker ? 'Back to profile' : 'Open application tracker'}
          >
            {/* Bookmark shape */}
            <motion.div
              className="absolute inset-0 border border-border/40"
              animate={{
                borderRadius: showTracker ? '0 6px 6px 0' : '6px 0 0 6px',
                backgroundColor: showTracker ? 'var(--color-foreground)' : 'var(--color-primary)',
                borderLeftWidth: showTracker ? 0 : 1,
                borderRightWidth: showTracker ? 1 : 0,
              }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
              layout
            />

            {/* Arrow chevron */}
            <motion.div
              className="relative z-10"
              animate={{ rotate: showTracker ? 180 : 0 }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <svg
                width="8"
                height="14"
                viewBox="0 0 8 14"
                fill="none"
                className="group-hover:scale-110 transition-transform duration-150"
              >
                <motion.path
                  d="M6 2L2 7L6 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  animate={{
                    stroke: showTracker
                      ? 'var(--color-background)'
                      : 'var(--color-primary-foreground)',
                  }}
                  transition={{ duration: 0.3 }}
                />
              </svg>
            </motion.div>

            {/* Hover tooltip */}
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 pointer-events-none',
                'px-2.5 py-1.5 rounded-lg',
                'bg-popover/95 backdrop-blur-sm border border-border/50 shadow-lg',
                'text-[10px] font-medium text-foreground/60 whitespace-nowrap',
                'opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100',
                'transition-all duration-200 ease-out',
                showTracker ? 'left-full ml-3 text-left' : 'right-full mr-3 text-right',
              )}
            >
              <span className="block">
                {showTracker ? 'Back to Profile →' : '← Application Tracker'}
              </span>
              <span className="block text-[8px] text-foreground/50 mt-0.5 font-normal">
                {showTracker ? 'Edit your profile and fill forms' : 'View your application history'}
              </span>
            </div>
          </motion.button>
        </motion.div>

        {/* ── FillBar: always visible ── */}
        <FillBar
          onFill={handleFill}
          isLoading={isLoading}
          result={result}
          logs={logs}
          pageUrl={pageUrl}
          profileReady={profileReady}
          onExport={exportAllData}
          onImport={importData}
          onDeleteAll={deleteAllData}
        />

        <DeletePresetDialog
          open={deletePresetId !== null}
          presetName={presets.find((p) => p.id === deletePresetId)?.name ?? ''}
          onConfirm={() => {
            if (deletePresetId) removePreset(deletePresetId);
            setDeletePresetId(null);
          }}
          onCancel={() => setDeletePresetId(null)}
        />
      </div>
    </FormProvider>
  );
}
