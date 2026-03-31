import { useState, useRef, useEffect } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type View = 'days' | 'months' | 'years';

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  alignRight?: boolean;
  bare?: boolean;
}

function parseDate(val?: string): { year: number; month: number; day: number } | null {
  if (!val) return null;
  const m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: +m[1]!, month: +m[2]!, day: +m[3]! };
}

function formatDisplay(val?: string): string {
  const d = parseDate(val);
  if (!d) return '';
  return `${String(d.month).padStart(2, '0')}/${String(d.day).padStart(2, '0')}/${d.year}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/** Auto-format typed input as MM/DD/YYYY */
function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Parse MM/DD/YYYY to YYYY-MM-DD or return null */
function parseTypedDate(text: string): string | null {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const month = +m[1]!,
    day = +m[2]!,
    year = +m[3]!;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  if (day > getDaysInMonth(year, month)) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function DatePicker({
  value,
  onChange,
  placeholder = 'MM/DD/YYYY',
  alignRight = false,
  bare = false,
}: DatePickerProps) {
  const parsed = parseDate(value);
  const now = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth() + 1);
  const [view, setView] = useState<View>('days');
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState(formatDisplay(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input text when value changes externally (e.g., calendar selection)
  useEffect(() => {
    if (!inputRef.current || document.activeElement !== inputRef.current) {
      setInputText(formatDisplay(value)); // eslint-disable-line react-hooks/set-state-in-effect -- intentional sync from prop
    }
  }, [value]);

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (!v) setView('days');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateInput(e.target.value);
    setInputText(formatted);

    const iso = parseTypedDate(formatted);
    if (iso) {
      onChange(iso);
      const d = parseDate(iso);
      if (d) {
        setViewYear(d.year);
        setViewMonth(d.month);
      }
    }
  };

  const handleInputBlur = () => {
    const iso = parseTypedDate(inputText);
    if (iso) {
      onChange(iso);
    } else if (inputText && inputText !== formatDisplay(value)) {
      // Only reset if text is non-empty and invalid
      setInputText(formatDisplay(value));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const iso = parseTypedDate(inputText);
      if (iso) {
        onChange(iso);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputText(formatDisplay(value));
      setOpen(false);
    }
  };

  const prevNav = () => {
    if (view === 'years') setViewYear((y) => y - 12);
    else if (view === 'months') setViewYear((y) => y - 1);
    else {
      if (viewMonth === 1) {
        setViewMonth(12);
        setViewYear((y) => y - 1);
      } else setViewMonth((m) => m - 1);
    }
  };

  const nextNav = () => {
    if (view === 'years') setViewYear((y) => y + 12);
    else if (view === 'months') setViewYear((y) => y + 1);
    else {
      if (viewMonth === 12) {
        setViewMonth(1);
        setViewYear((y) => y + 1);
      } else setViewMonth((m) => m + 1);
    }
  };

  const headerLabel =
    view === 'years'
      ? `${Math.floor(viewYear / 12) * 12} – ${Math.floor(viewYear / 12) * 12 + 11}`
      : view === 'months'
        ? `${viewYear}`
        : `${MONTHS[viewMonth - 1]} ${viewYear}`;

  const headerClick = () => {
    if (view === 'days') setView('months');
    else if (view === 'months') setView('years');
  };

  const selectDay = (day: number) => {
    const mm = String(viewMonth).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const iso = `${viewYear}-${mm}-${dd}`;
    onChange(iso);
    setInputText(formatDisplay(iso));
    setOpen(false);
    setView('days');
  };

  const selectMonth = (month: number) => {
    setViewMonth(month);
    setView('days');
  };

  const selectYear = (year: number) => {
    setViewYear(year);
    setView('months');
  };

  const isSelectedDay = (day: number) =>
    parsed?.year === viewYear && parsed?.month === viewMonth && parsed?.day === day;

  const isToday = (day: number) =>
    now.getFullYear() === viewYear && now.getMonth() + 1 === viewMonth && now.getDate() === day;

  const yearStart = Math.floor(viewYear / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => yearStart + i);

  return (
    <Popover open={open} onOpenChange={() => {}}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            'flex items-center gap-1 bg-transparent rounded-none px-0 text-sm',
            bare
              ? 'border-0 h-auto py-0'
              : 'w-full h-9 border-0 border-b border-input py-2 transition-colors hover:border-b-muted-foreground/60 focus-within:border-b-foreground',
            alignRight ? 'justify-end text-right' : 'justify-between',
          )}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            placeholder={placeholder}
            onChange={(e) => {
              handleInputChange(e);
              if (!open) handleOpen(true);
            }}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className={cn(
              'w-full bg-transparent outline-none text-sm min-w-0 cursor-text',
              alignRight && 'text-right',
              !inputText && 'text-muted-foreground',
            )}
          />
          <ChevronDown
            size={12}
            className={cn(
              'shrink-0 text-muted-foreground ml-1 transition-transform cursor-pointer',
              open && 'rotate-180',
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              handleOpen(!open);
            }}
          />
        </div>
      </PopoverAnchor>

      {open && (
        <PopoverContent
          className="w-[260px] p-3"
          align="end"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between mb-3">
            <Button type="button" variant="ghost" size="icon-xs" onClick={prevNav}>
              <ChevronLeft size={14} />
            </Button>
            <button
              type="button"
              onClick={headerClick}
              className="text-sm font-medium hover:bg-accent px-2 py-0.5 rounded-md transition-colors cursor-pointer"
            >
              {headerLabel}
            </button>
            <Button type="button" variant="ghost" size="icon-xs" onClick={nextNav}>
              <ChevronRight size={14} />
            </Button>
          </div>

          {view === 'years' && (
            <div className="grid grid-cols-3 gap-1">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => selectYear(y)}
                  className={cn(
                    'h-8 text-xs rounded-md transition-colors cursor-pointer',
                    parsed?.year === y
                      ? 'bg-primary text-primary-foreground font-medium'
                      : y === now.getFullYear()
                        ? 'bg-accent font-medium'
                        : 'hover:bg-accent',
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {view === 'months' && (
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectMonth(i + 1)}
                  className={cn(
                    'h-8 text-xs rounded-md transition-colors cursor-pointer',
                    parsed?.year === viewYear && parsed?.month === i + 1
                      ? 'bg-primary text-primary-foreground font-medium'
                      : viewMonth === i + 1
                        ? 'bg-accent font-medium'
                        : 'hover:bg-accent',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {view === 'days' && (
            <>
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-medium text-muted-foreground py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: getFirstDayOfWeek(viewYear, viewMonth) }, (_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {Array.from({ length: getDaysInMonth(viewYear, viewMonth) }, (_, i) => {
                  const day = i + 1;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => selectDay(day)}
                      className={cn(
                        'h-8 w-full text-xs rounded-md transition-colors cursor-pointer',
                        isSelectedDay(day)
                          ? 'bg-primary text-primary-foreground font-medium'
                          : isToday(day)
                            ? 'bg-accent font-medium'
                            : 'hover:bg-accent',
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setInputText('');
                setOpen(false);
                setView('days');
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                const iso = `${now.getFullYear()}-${mm}-${dd}`;
                onChange(iso);
                setInputText(formatDisplay(iso));
                setOpen(false);
                setView('days');
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}

export { DatePicker };
