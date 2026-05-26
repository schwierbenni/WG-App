'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-media-query'

// ─── Re-export primitives unchanged ─────────────────────────────────────────
export const ResponsiveModalRoot = DialogPrimitive.Root
export const ResponsiveModalTrigger = DialogPrimitive.Trigger
export const ResponsiveModalClose = DialogPrimitive.Close

// ─── Overlay ─────────────────────────────────────────────────────────────────
const ResponsiveModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
ResponsiveModalOverlay.displayName = 'ResponsiveModalOverlay'

// ─── Content – Bottom Sheet on mobile, centered dialog on desktop ─────────────
interface ResponsiveModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideClose?: boolean
}

const ResponsiveModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ResponsiveModalContentProps
>(({ className, children, hideClose, ...props }, ref) => {
  const isMobile = useIsMobile()

  return (
    <DialogPrimitive.Portal>
      <ResponsiveModalOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 bg-surface shadow-xl focus:outline-none',
          // ── Mobile: bottom sheet ──
          isMobile
            ? [
                'bottom-0 left-0 right-0 w-full',
                'rounded-t-3xl border-t-2 border-surface-border',
                'max-h-[90vh] overflow-y-auto',
                'pb-[env(safe-area-inset-bottom,0px)]',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
                'duration-300',
              ]
            : // ── Desktop: centered dialog ──
              [
                'left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]',
                'w-full max-w-lg rounded-2xl border-2 border-surface-border p-6',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
                'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
                'duration-200',
              ],
          className
        )}
        {...props}
      >
        {isMobile ? (
          <>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-surface-border" />
            </div>
            <div className="px-5 pb-6">{children}</div>
          </>
        ) : (
          children
        )}
        {!hideClose && (
          <DialogPrimitive.Close
            className={cn(
              'absolute rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-surface-muted hover:text-foreground focus:outline-none',
              isMobile ? 'right-4 top-4' : 'right-4 top-4'
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Schließen</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
ResponsiveModalContent.displayName = 'ResponsiveModalContent'

// ─── Header / Footer / Title / Description ────────────────────────────────────
const ResponsiveModalHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 mb-4', className)} {...props} />
)
ResponsiveModalHeader.displayName = 'ResponsiveModalHeader'

const ResponsiveModalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-4', className)} {...props} />
)
ResponsiveModalFooter.displayName = 'ResponsiveModalFooter'

const ResponsiveModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-bold text-foreground leading-none tracking-tight', className)}
    {...props}
  />
))
ResponsiveModalTitle.displayName = 'ResponsiveModalTitle'

const ResponsiveModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[var(--text-muted)]', className)}
    {...props}
  />
))
ResponsiveModalDescription.displayName = 'ResponsiveModalDescription'

export {
  ResponsiveModalOverlay,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalFooter,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
}
