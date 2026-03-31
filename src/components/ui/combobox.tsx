import { useState, useRef, useEffect, useCallback } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  alignRight?: boolean;
  bare?: boolean;
}

function Combobox({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  className,
  alignRight = false,
  bare = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIdx(0); // eslint-disable-line react-hooks/set-state-in-effect
  }, [filtered.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-option]');
    items[highlightIdx]?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  const handleSelect = useCallback(
    (opt: string) => {
      onValueChange(opt);
      setQuery('');
      setOpen(false);
    },
    [onValueChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIdx]) {
          handleSelect(filtered[highlightIdx]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setQuery('');
        setOpen(false);
        break;
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if focus moved to the dropdown
    const related = e.relatedTarget as HTMLElement | null;
    if (related && listRef.current?.contains(related)) return;

    // Keep value if query matches an option exactly
    if (query) {
      const exact = options.find((opt) => opt.toLowerCase() === query.toLowerCase());
      if (exact) {
        onValueChange(exact);
      }
    }
    setQuery('');
    // Small delay so click events on options fire before close
    setTimeout(() => setOpen(false), 150);
  };

  return (
    <Popover open={open} onOpenChange={() => {}}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            'relative flex items-center gap-1 bg-transparent rounded-none px-0 text-sm',
            bare
              ? 'border-0 h-auto py-0'
              : 'w-full h-9 border-0 border-b border-input py-2 transition-colors hover:border-b-muted-foreground/60 focus-within:border-b-foreground',
            alignRight ? 'justify-end text-right' : 'justify-between',
            className,
          )}
        >
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            value={open ? query : value}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => {
              if (!open) {
                setQuery(value);
                setOpen(true);
              }
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full bg-transparent outline-none text-sm min-w-0 cursor-text',
              alignRight && 'text-right',
              !value && !query && 'text-muted-foreground',
            )}
          />
          <ChevronDown
            size={14}
            className={cn(
              'shrink-0 text-muted-foreground ml-1 transition-transform cursor-pointer',
              open && 'rotate-180',
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              if (open) {
                setOpen(false);
                setQuery('');
              } else {
                setOpen(true);
                inputRef.current?.focus();
              }
            }}
          />
        </div>
      </PopoverAnchor>

      {open && (
        <PopoverContent
          className="w-[240px] p-1 bg-popover border border-border shadow-md"
          align="end"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div ref={listRef} role="listbox" className="max-h-[200px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">No results found</div>
            ) : (
              filtered.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  data-option
                  tabIndex={-1}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt);
                    inputRef.current?.focus();
                  }}
                  className={cn(
                    'flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors',
                    i === highlightIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                    value === opt && i !== highlightIdx && 'text-primary',
                  )}
                >
                  <span className="truncate">{opt}</span>
                  {value === opt && <Check size={13} className="shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}

export { Combobox };
