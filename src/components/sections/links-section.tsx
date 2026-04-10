import { useFormContext, useFieldArray } from 'react-hook-form';
import { LedgerRow, LedgerInput } from '@/components/ui/ledger-row';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Profile } from '@/lib/schema';

const FIXED_LINKS = [
  { key: 'linkedin' as const, label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...' },
  { key: 'github' as const, label: 'GitHub', placeholder: 'https://github.com/...' },
  { key: 'twitter' as const, label: 'Twitter / X', placeholder: 'https://x.com/...' },
  { key: 'portfolio' as const, label: 'Portfolio', placeholder: 'https://...' },
];

export function LinksSection() {
  const { register, control } = useFormContext<Profile>();
  const { fields, append, remove } = useFieldArray({ control, name: 'additionalLinks' });

  return (
    <div className="flex flex-col relative">
      <button
        type="button"
        onClick={() => append({ label: '', url: '' })}
        className="absolute -top-[52px] right-0 w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-all cursor-pointer"
        aria-label="Add link"
      >
        <Plus size={16} />
      </button>

      <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/50 mb-1">
        Profiles
      </span>
      {FIXED_LINKS.map(({ key, label, placeholder }) => (
        <LedgerRow key={key} label={label}>
          <LedgerInput placeholder={placeholder} aria-label={label} {...register(key)} />
        </LedgerRow>
      ))}

      <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/50 mt-6 mb-1">
        Additional
      </span>

      <LedgerRow label="Other">
        <LedgerInput
          placeholder="https://..."
          aria-label="Other URL"
          {...register('additionalUrl')}
        />
      </LedgerRow>

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
            <LedgerRow label="">
              <div className="flex items-center gap-3 w-full">
                <LedgerInput
                  placeholder="Label"
                  aria-label="Link label"
                  className="w-20 shrink-0 !text-left"
                  {...register(`additionalLinks.${index}.label`)}
                />
                <LedgerInput
                  placeholder="https://..."
                  aria-label="Link URL"
                  {...register(`additionalLinks.${index}.url`)}
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-muted-foreground/30 hover:text-destructive transition-colors cursor-pointer shrink-0"
                  aria-label="Remove link"
                >
                  <X size={12} />
                </button>
              </div>
            </LedgerRow>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
