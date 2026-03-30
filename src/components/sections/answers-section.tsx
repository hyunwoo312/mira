import { useState } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ArrowUpRight } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { LedgerRow, LedgerInput } from '@/components/ui/ledger-row';
import type { Profile } from '@/lib/schema';

function AnswerItem({
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
  const { watch, register } = useFormContext<Profile>();
  const entry = watch(`answerBank.${index}`);
  const question = entry?.question || 'No question';
  const answer = entry?.answer || '';
  const answerLen = answer.length;
  const [hovered, setHovered] = useState(false);

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
        <div className="flex-1 min-w-0 mr-3">
          <div className="font-medium tracking-tight leading-tight truncate">{question}</div>
          {answer && <div className="text-sm text-muted-foreground mt-0.5 truncate">{answer}</div>}
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
              <LedgerRow label="Question">
                <LedgerInput
                  placeholder="Why do you want to work here?"
                  aria-label="Question"
                  {...register(`answerBank.${index}.question`)}
                />
              </LedgerRow>
              <LedgerRow label="Response" column>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-muted-foreground/40 tabular-nums">
                    {answerLen}/2000
                  </span>
                </div>
                <Textarea
                  {...register(`answerBank.${index}.answer`)}
                  placeholder="Your response..."
                  className="text-sm resize-y min-h-[80px]"
                />
              </LedgerRow>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SUGGESTED_QUESTIONS = [
  'Why do you want to work here?',
  'Tell us about yourself',
  'What is your greatest strength?',
  'Describe a challenging project',
  'What motivates you?',
];

export function AnswersSection() {
  const { control, getValues } = useFormContext<Profile>();
  const { fields, append, remove } = useFieldArray({ control, name: 'answerBank' });
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleAdd = () => {
    append({ question: '', answer: '' });
    setExpandedIndex(fields.length);
  };
  const handleToggle = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const existingQuestions = fields.map(
    (_, i) => getValues(`answerBank.${i}.question`)?.toLowerCase() ?? '',
  );
  const suggestions = SUGGESTED_QUESTIONS.filter(
    (q) => !existingQuestions.includes(q.toLowerCase()),
  );
  const addSuggested = (question: string) => {
    append({ question, answer: '' });
    setExpandedIndex(fields.length);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleAdd}
        className="absolute -top-[52px] right-0 w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-all cursor-pointer"
        aria-label="Add Q&A"
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
            Pre-answer common questions. The autofiller uses ML to match your answers to application
            fields.
          </motion.p>
        )}
      </AnimatePresence>

      {fields.map((field, index) => (
        <AnswerItem
          key={field.id}
          index={index}
          num={String(index + 1).padStart(2, '0')}
          isFirst={index === 0}
          isExpanded={expandedIndex === index}
          onToggle={() => handleToggle(index)}
          onRemove={() => {
            if (expandedIndex === index) setExpandedIndex(null);
            remove(index);
          }}
        />
      ))}

      <AnimatePresence>
        {expandedIndex === null && suggestions.length > 0 && fields.length < 10 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-1.5 pt-2"
          >
            <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium">
              Suggested
            </span>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => addSuggested(q)}
                  className="px-2.5 py-1 rounded-full text-[11px] text-muted-foreground/60 border border-dashed border-border hover:text-foreground hover:border-foreground/30 hover:bg-accent transition-all cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
