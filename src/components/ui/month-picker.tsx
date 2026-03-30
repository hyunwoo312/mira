import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthPickerProps {
  value?: { month: number; year: number } | null;
  onChange: (value: { month: number; year: number }) => void;
  placeholder?: string;
  alignRight?: boolean;
  bare?: boolean;
}

function MonthPicker({
  value,
  onChange,
  placeholder = 'Select...',
  alignRight = false,
  bare = false,
}: MonthPickerProps) {
  const [year, setYear] = useState(value?.year ?? new Date().getFullYear());
  const [open, setOpen] = useState(false);
  const [yearMode, setYearMode] = useState(false);

  const displayText = value ? `${MONTHS[value.month - 1]} ${value.year}` : null;
  const currentYear = new Date().getFullYear();

  // Generate year grid centered around current view
  const yearStart = Math.floor(year / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => yearStart + i);

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setYearMode(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={displayText ?? placeholder}
          className={cn(
            'flex items-center gap-1 bg-transparent rounded-none px-0 text-sm cursor-pointer outline-none',
            bare
              ? 'border-0 h-auto py-0'
              : 'w-full h-9 border-0 border-b border-input py-2 transition-colors hover:border-b-muted-foreground/60 focus-visible:border-b-foreground focus-visible:ring-0',
            alignRight ? 'justify-end text-right' : 'justify-between',
            !displayText && 'text-muted-foreground',
          )}
        >
          <span>{displayText ?? placeholder}</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[220px] p-3" align="end">
        <div className="flex items-center justify-between mb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setYear((y) => (yearMode ? y - 12 : y - 1))}
          >
            <ChevronLeft size={14} />
          </Button>

          <button
            type="button"
            onClick={() => setYearMode(!yearMode)}
            className="text-sm font-semibold hover:text-primary transition-colors cursor-pointer px-2 py-0.5 rounded-md hover:bg-accent"
          >
            {yearMode ? `${yearStart}–${yearStart + 11}` : year}
          </button>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setYear((y) => (yearMode ? y + 12 : y + 1))}
          >
            <ChevronRight size={14} />
          </Button>
        </div>

        {yearMode ? (
          <div className="grid grid-cols-3 gap-1">
            {years.map((y) => {
              const isSelected = value?.year === y;
              return (
                <Button
                  type="button"
                  key={y}
                  variant={isSelected ? 'default' : 'ghost'}
                  size="sm"
                  className={cn('text-xs h-7', y > currentYear + 2 && 'text-muted-foreground/40')}
                  onClick={() => {
                    setYear(y);
                    setYearMode(false);
                  }}
                >
                  {y}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1">
            {MONTHS.map((m, i) => {
              const isSelected = value?.month === i + 1 && value?.year === year;
              return (
                <Button
                  type="button"
                  key={m}
                  variant={isSelected ? 'default' : 'ghost'}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    onChange({ month: i + 1, year });
                    setOpen(false);
                  }}
                >
                  {m}
                </Button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export { MonthPicker };
