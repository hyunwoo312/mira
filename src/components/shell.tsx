import { useState, useCallback } from 'react';
import { FormProvider } from 'react-hook-form';
import { motion } from 'framer-motion';
import { PresetBar } from './preset-bar';
import { ProfileCompleteness } from './profile-completeness';
import { TabBar } from './tab-bar';
import { FillBar } from './fill-bar';
import { Section } from './section';
import { DeletePresetDialog } from './delete-preset-dialog';
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
import { useMLStatus } from '@/hooks/use-ml-status';
import { PROFILE_SECTIONS } from '@/types/profile';
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
    exportAllData,
    importData,
    deleteAllData,
  } = useProfile();
  const { isLoading, result, logs, pageUrl, fill } = useFill(activePresetId);
  const { files } = useFiles(activePresetId);
  const { mlStatus, mlProgress } = useMLStatus();

  const firstName = form.watch('firstName');
  const lastName = form.watch('lastName');
  const email = form.watch('email');
  const profileReady = !!(firstName?.trim() && lastName?.trim() && email?.trim());

  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);

  const handleFill = useCallback(() => {
    fill(form.getValues());
  }, [fill, form]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 border-2 border-muted border-t-primary rounded-full"
          />
          <span className="text-[11px] text-muted-foreground">Loading your profiles…</span>
        </motion.div>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <div className="flex flex-col h-screen bg-background">
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

        <div ref={containerRef} className="flex-1 overflow-y-auto scroll-area px-6 pt-4 pb-32">
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

        <FillBar
          onFill={handleFill}
          isLoading={isLoading}
          result={result}
          logs={logs}
          pageUrl={pageUrl}
          mlStatus={mlStatus}
          mlProgress={mlProgress}
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
