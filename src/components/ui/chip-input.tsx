import { useState, useRef, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ChipInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

function ChipInput({ value, onChange, placeholder = 'Add...', className }: ChipInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addChip = (text: string) => {
    const trimmed = text.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
  };

  const removeChip = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeChip(value.length - 1);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1.5 min-h-9 w-full border-0 border-b border-input bg-transparent rounded-none px-0 py-1.5 transition-colors cursor-text',
        'focus-within:border-b-foreground',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <AnimatePresence initial={false}>
        {value.map((chip, i) => (
          <motion.span
            key={chip}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-border bg-transparent text-foreground text-xs"
          >
            {chip}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeChip(i);
              }}
              aria-label={`Remove ${chip}`}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={12} />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) addChip(inputValue);
        }}
        placeholder={value.length === 0 ? placeholder : 'Press Enter to add'}
        className="flex-1 min-w-[60px] bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}

export { ChipInput };
