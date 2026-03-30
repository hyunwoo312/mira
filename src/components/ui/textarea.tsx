import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full border-0 border-b border-input bg-transparent rounded-none px-0 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50',
        'hover:border-b-muted-foreground/60',
        'focus-visible:border-b-foreground focus-visible:ring-0',
        'aria-invalid:border-b-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
