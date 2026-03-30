import { useState, forwardRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LedgerRowProps {
  label: string;
  children: ReactNode;
  className?: string;
  column?: boolean;
}

export function LedgerRow({ label, children, className, column = false }: LedgerRowProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={cn(
        'relative',
        column ? 'flex flex-col gap-2 py-3.5' : 'flex items-center justify-between py-3.5',
        className,
      )}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      <label className="text-[10px] uppercase tracking-[0.05em] font-medium text-muted-foreground shrink-0">
        {label}
      </label>
      <div className={cn(!column && 'flex-1 flex justify-end')}>{children}</div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
      <motion.div
        className="absolute bottom-0 left-0 h-px bg-foreground"
        initial={false}
        animate={{
          width: focused ? '100%' : '0%',
          opacity: focused ? [1, 0.5, 1] : 1,
        }}
        transition={{
          width: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
          opacity: { duration: 0.6, delay: 0.2, times: [0, 0.5, 1] },
        }}
      />
    </div>
  );
}

/** Right-aligned bare input for use inside LedgerRow */
export const LedgerInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'bg-transparent border-none outline-none text-sm text-right w-full text-foreground placeholder:text-muted-foreground/40',
      'focus-visible:text-foreground',
      className,
    )}
    {...props}
  />
));
LedgerInput.displayName = 'LedgerInput';
