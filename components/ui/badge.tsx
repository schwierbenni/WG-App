import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-brand-600 text-white',
        secondary:
          'bg-surface-muted text-foreground border border-surface-border',
        destructive:
          'bg-[var(--danger-bg)] text-[var(--danger)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)]',
        outline:
          'border-2 border-surface-border text-[var(--text-muted)]',
        success:
          'bg-[var(--success-bg)] text-[var(--success)]',
        warning:
          'bg-[var(--warning-bg)] text-[var(--warning)]',
        info:
          'bg-[var(--info-bg)] text-[var(--info)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
