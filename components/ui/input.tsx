'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-xl border-2 border-surface-border bg-surface px-4 py-2 text-sm text-foreground shadow-sm transition-colors',
        'placeholder:text-[var(--text-subtle)]',
        'focus-visible:outline-none focus-visible:border-brand-600 focus-visible:ring-0',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export { Input }
