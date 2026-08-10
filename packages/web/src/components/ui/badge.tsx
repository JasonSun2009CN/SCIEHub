import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-default',
  {
    variants: {
      variant: {
        default: 'bg-accent-subtle text-accent',
        secondary: 'bg-surface-2 text-muted-foreground',
        outline: 'border border-border text-muted-foreground',
        success: 'bg-success-subtle text-success',
        error: 'bg-error-subtle text-error',
        warning: 'bg-[rgb(251_191_36_/_0.12)] text-warning',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
