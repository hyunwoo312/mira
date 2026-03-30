import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 border-0 border-b border-input bg-transparent rounded-none px-0 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'hover:border-b-muted-foreground/60',
        'focus-visible:border-b-foreground focus-visible:ring-0',
        'aria-invalid:border-b-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
