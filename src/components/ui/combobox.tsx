import { useState } from 'react';
import { Command } from 'cmdk';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  alignRight?: boolean;
  bare?: boolean;
}

function Combobox({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  className,
  alignRight = false,
  bare = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={value || placeholder}
          className={cn(
            'flex items-center gap-1 bg-transparent rounded-none px-0 text-sm outline-none cursor-pointer',
            bare
              ? 'border-0 h-auto py-0'
              : 'w-full h-9 border-0 border-b border-input py-2 transition-colors hover:border-b-muted-foreground/60 focus-visible:border-b-foreground focus-visible:ring-0',
            alignRight ? 'justify-end text-right' : 'justify-between',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronDown size={14} className="shrink-0 text-muted-foreground ml-2" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[240px] p-0 bg-popover border border-border shadow-md"
        align="end"
      >
        <Command className="bg-transparent">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <Command.Input
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search options"
            />
          </div>
          <Command.List className="max-h-[200px] overflow-y-auto p-1">
            <Command.Empty className="py-4 text-center text-xs text-muted-foreground">
              No results found
            </Command.Empty>
            {options.map((opt) => (
              <Command.Item
                key={opt}
                value={opt}
                onSelect={() => {
                  onValueChange(opt === value ? '' : opt);
                  setOpen(false);
                }}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                <span className="truncate">{opt}</span>
                {value === opt && <Check size={13} className="shrink-0 text-primary" />}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { Combobox };
