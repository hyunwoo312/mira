import { useCallback, useEffect, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { PresetBar } from './preset-bar';
import { ProfileCompleteness } from './profile-completeness';
import { TabBar } from './tab-bar';
import { FillBar } from './fill-bar';
import { BottomNav, type TopLevelTab } from './bottom-nav';
import { Section } from './section';
import { DeletePresetDialog } from './delete-preset-dialog';
import { ApplicationTracker } from './application-tracker';
import { EmptyStatePrompt } from './empty-state-prompt';
import { ImportReviewModal, type CommitArgs } from './import-review-modal';
import { UndoImportBanner } from './undo-import-banner';
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
import { useProfileWithDemo } from '@/hooks/use-profile-with-demo';
import { useFill } from '@/hooks/use-fill';
import { useFiles } from '@/hooks/use-files';
import { useImportPrompt } from '@/hooks/use-import-prompt';
import { useResumeImport } from '@/hooks/use-resume-import';
import { PROFILE_SECTIONS } from '@/types/profile';
import { cn } from '@/lib/utils';
import { clearAllAnswerBanks } from '@/lib/storage';
import { commitImport, validateParsedFields } from '@/lib/import/commit';
import { dismissImportPrompt } from '@/lib/import/empty-state';
import type { Profile } from '@/lib/schema';
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
    isDemoActive,
  } = useProfileWithDemo();
  const { isLoading, result, logs, pageUrl, error, fill } = useFill();
  const { files, addFile, removeFile } = useFiles(activePresetId);

  const firstName = form.watch('firstName');
  const lastName = form.watch('lastName');
  const email = form.watch('email');
  // Demo preset has blank name fields by design — keep Fill enabled so the
  // walkthrough's autofill can still be triggered without forcing setup.
  const profileReady = isDemoActive || !!(firstName?.trim() && lastName?.trim() && email?.trim());

  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TopLevelTab>('profile');
  const [profileAnimKey, setProfileAnimKey] = useState(0);
  const [importErrorToast, setImportErrorToast] = useState<string | null>(null);
  const [undoTarget, setUndoTarget] = useState<{
    profile: Profile;
    attachedFileId: string | null;
  } | null>(null);
  const showTracker = activeTab === 'tracker';

  const handleTabChange = useCallback((tab: TopLevelTab) => {
    setActiveTab(tab);
    if (tab === 'profile') setProfileAnimKey((k) => k + 1);
  }, []);

  const handleFill = useCallback(async () => {
    await saveNow();
    fill(activePresetId);
  }, [saveNow, fill, activePresetId]);

  // ── Resume import wiring ──────────────────────────────────────────────────
  const showImportError = useCallback((message: string) => {
    setImportErrorToast(message);
  }, []);

  useEffect(() => {
    if (!importErrorToast) return;
    const timer = setTimeout(() => setImportErrorToast(null), 6000);
    return () => clearTimeout(timer);
  }, [importErrorToast]);

  const importFlow = useResumeImport({ onError: showImportError });
  const importPrompt = useImportPrompt({
    presetId: activePresetId,
    profile: form.getValues(),
    paused: isDemoActive,
  });

  const handleImportCommit = useCallback(
    async (args: CommitArgs) => {
      const payload = importFlow.pending;
      if (!payload) return;

      const baseProfile = form.getValues();
      const sanitizedFields = validateParsedFields(payload.fields);
      const result = commitImport(baseProfile, { ...payload, fields: sanitizedFields }, args.mode);
      form.reset(result.profile);
      await saveNow();

      let attachedFileId: string | null = null;
      if (result.attachFile) {
        const stored = await addFile(payload.file, 'resume');
        attachedFileId = stored?.id ?? null;
      }

      await dismissImportPrompt(args.target.presetId);
      setUndoTarget({ profile: baseProfile, attachedFileId });
    },
    [importFlow.pending, form, saveNow, addFile],
  );

  // TTL the undo banner — 10s after import, banner disappears.
  useEffect(() => {
    if (!undoTarget) return;
    const timer = setTimeout(() => setUndoTarget(null), 10_000);
    return () => clearTimeout(timer);
  }, [undoTarget]);

  // Drop a stale undo target when the user switches presets — undoing into
  // a different preset would corrupt it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on preset switch
    setUndoTarget(null);
  }, [activePresetId]);

  const handleUndoImport = useCallback(async () => {
    if (!undoTarget) return;
    form.reset(undoTarget.profile);
    await saveNow();
    if (undoTarget.attachedFileId) {
      await removeFile(undoTarget.attachedFileId);
    }
    setUndoTarget(null);
  }, [undoTarget, form, saveNow, removeFile]);

  const handleFillManually = useCallback(() => {
    void importPrompt.dismiss();
  }, [importPrompt]);

  const showEmptyState = activeTab === 'profile' && importPrompt.shouldShow;

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
                  onExport={exportAllData}
                  onImport={importData}
                  onImportResume={isDemoActive ? undefined : importFlow.triggerImport}
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
                onExport={exportAllData}
                onImport={importData}
                onImportResume={isDemoActive ? undefined : importFlow.triggerImport}
              />
              <ProfileCompleteness lastSaved={lastSaved} hasDocuments={files.length > 0} />
              <TabBar activeSection={activeSection} onTabClick={scrollToSection} />
            </>
          )}
        </div>

        <div
          ref={containerRef}
          className={cn(
            'flex-1 overflow-y-auto scroll-area px-6 pt-4 pb-32 relative',
            profileAnimKey > 0 && 'animate-slide-in-left',
          )}
          key={`scroll-${profileAnimKey}`}
          style={{ display: showTracker ? 'none' : undefined }}
        >
          <ImportErrorToast
            message={importErrorToast}
            onDismiss={() => setImportErrorToast(null)}
          />
          <UndoImportBanner
            active={undoTarget !== null}
            onUndo={handleUndoImport}
            onDismiss={() => setUndoTarget(null)}
          />
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
                  <DocumentsSection
                    presetId={activePresetId}
                    onResumePdf={isDemoActive ? undefined : importFlow.parseFile}
                  />
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

        {/* ── Footer region: FillBar + BottomNav share bg + top border ── */}
        <div className="border-t border-border bg-[oklch(0.87_0.025_70)] dark:bg-[oklch(0.24_0.012_70)]">
          <FillBar
            onFill={handleFill}
            isLoading={isLoading}
            result={result}
            logs={logs}
            pageUrl={pageUrl}
            error={error}
            profileReady={profileReady}
          />
          <BottomNav
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onDeleteAll={deleteAllData}
            onClearAnswerBank={async () => {
              await clearAllAnswerBanks();
              form.setValue('answerBank', []);
            }}
          />
        </div>

        <DeletePresetDialog
          open={deletePresetId !== null}
          presetName={presets.find((p) => p.id === deletePresetId)?.name ?? ''}
          onConfirm={() => {
            if (deletePresetId) removePreset(deletePresetId);
            setDeletePresetId(null);
          }}
          onCancel={() => setDeletePresetId(null)}
        />

        <EmptyStatePrompt
          open={showEmptyState && !showTracker}
          onDismiss={handleFillManually}
          onImportResume={importFlow.triggerImport}
          parsing={importFlow.parsing}
        />

        <ImportReviewModal
          open={importFlow.pending !== null}
          onClose={importFlow.closeReview}
          payload={importFlow.pending}
          currentProfile={form.getValues()}
          activePresetId={activePresetId}
          onCommit={handleImportCommit}
        />

        <ParsingIndicator visible={importFlow.parsing} />
      </div>
    </FormProvider>
  );
}

function ParsingIndicator({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-md bg-popover border border-border shadow-md text-[11px] font-medium text-foreground/80"
          role="status"
          aria-live="polite"
        >
          Parsing your resume…
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ImportErrorToast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          className="sticky top-2 mx-3 z-20 rounded-lg border border-destructive/50 bg-[oklch(0.87_0.025_70)] dark:bg-[oklch(0.24_0.012_70)] shadow-sm overflow-hidden"
          role="alert"
        >
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="text-[9px] uppercase tracking-[0.14em] font-semibold text-destructive shrink-0">
              Error
            </span>
            <span className="flex-1 text-[12px] text-foreground/85 leading-snug">{message}</span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="text-foreground/40 hover:text-foreground/70 transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
