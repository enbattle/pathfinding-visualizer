import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A small two-or-more-option toggle (aria-pressed buttons in a group). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'sm',
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
  size?: 'sm' | 'xs';
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex w-fit rounded-lg border border-input bg-input/30 p-0.5"
    >
      {options.map(option => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={value === option.value}
          className={cn(
            size === 'xs' && 'h-7 px-2.5 text-xs',
            value === option.value &&
              'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
          )}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </Button>
      ))}
    </div>
  );
}
