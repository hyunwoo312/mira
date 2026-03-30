import { useFormContext, Controller, useFieldArray } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ChipInput } from '@/components/ui/chip-input';
import { LedgerRow, LedgerInput } from '@/components/ui/ledger-row';
import { Plus, X, Award, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Profile } from '@/lib/schema';

const PROFICIENCY_OPTIONS = ['Beginner', 'Intermediate', 'Advanced', 'Fluent', 'Native'];

export function SkillsSection() {
  const { control, register } = useFormContext<Profile>();
  const { fields, append, remove } = useFieldArray({ control, name: 'languages' });

  return (
    <div className="space-y-5">
      {/* Skills */}
      <div className="space-y-1.5">
        <Label>Skills</Label>
        <Controller
          name="skills"
          control={control}
          render={({ field }) => (
            <ChipInput
              value={field.value}
              onChange={field.onChange}
              placeholder="e.g. React, Python, AWS — press Enter to add"
            />
          )}
        />
        {!fields.length && (
          <p className="text-[10px] text-muted-foreground/50 mt-1">
            Used to match skill-related questions on applications.
          </p>
        )}
      </div>

      {/* Certifications */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Award size={12} className="text-muted-foreground" />
          <Label>Certifications</Label>
        </div>
        <Controller
          name="certifications"
          control={control}
          render={({ field }) => (
            <ChipInput
              value={field.value}
              onChange={field.onChange}
              placeholder="e.g. AWS Solutions Architect, PMP"
            />
          )}
        />
      </div>

      {/* Languages */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 mb-2">
          <Languages size={12} className="text-muted-foreground" />
          <Label>Languages</Label>
        </div>

        <AnimatePresence initial={false}>
          {fields.map((field, index) => (
            <motion.div
              key={field.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <LedgerRow label={index === 0 ? 'Language' : `Language ${index + 1}`}>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <LedgerInput
                    placeholder="e.g. English"
                    aria-label="Language"
                    {...register(`languages.${index}.language`)}
                  />
                  <Controller
                    name={`languages.${index}.proficiency`}
                    control={control}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger className="w-auto h-auto border-0 border-b-0 px-0 py-0 text-sm text-right justify-end">
                          <SelectValue placeholder="Level" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROFICIENCY_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer shrink-0"
                    aria-label="Remove language"
                  >
                    <X size={12} />
                  </button>
                </div>
              </LedgerRow>
            </motion.div>
          ))}
        </AnimatePresence>

        {fields.length === 0 && (
          <p className="text-[10px] text-muted-foreground/50 py-2">
            Add languages you speak and their proficiency level.
          </p>
        )}

        <button
          type="button"
          onClick={() => append({ language: '', proficiency: '' })}
          className="mt-2 w-8 h-8 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-all cursor-pointer mx-auto"
          aria-label="Add language"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
