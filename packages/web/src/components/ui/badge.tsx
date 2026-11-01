import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors cursor-default',
  {
    variants: {
      variant: {
        default: 'bg-accent-subtle text-accent',
        secondary: 'bg-surface-2 text-muted-foreground',
        outline: 'border border-border text-muted-foreground',
        success: 'bg-success-subtle text-success',
        error: 'bg-error-subtle text-error',
        warning: 'bg-warning-subtle text-warning',
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
