import * as TooltipPrimitive from '@radix-ui/react-tooltip'
/**
 * @file Tooltip component wrapper
 * @description Extended Tooltip with simplified API and proper TypeScript types.
 * Supports both standard Radix composition and simplified content prop.
 * Automatically registers in UIStore to hide WebContentsView when open.
 */
import * as React from 'react'

import { cn } from '@/shared/utils/utils'
import { useUIStore } from '../store/uiStore'

const TooltipProvider = TooltipPrimitive.Provider

const TooltipRoot = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-[var(--z-modal)] overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Extended Tooltip with simplified API
export interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  delayDuration?: number
  className?: string
}

/**
 * Tooltip with automatic overlay registration
 * Registers in UIStore when open to hide WebContentsView
 */
const Tooltip = React.forwardRef<HTMLButtonElement, TooltipProps>(
  ({ children, content, side = 'top', align = 'center', delayDuration = 200, className }, ref) => {
    const [open, setOpen] = React.useState(false)
    const registerOverlay = useUIStore(state => state.registerOverlay)
    const unregisterOverlay = useUIStore(state => state.unregisterOverlay)
    const overlayIdRef = React.useRef(`tooltip-${Math.random().toString(36).substr(2, 9)}`)

    React.useEffect(() => {
      if (open) {
        registerOverlay(overlayIdRef.current)
      } else {
        unregisterOverlay(overlayIdRef.current)
      }

      return () => {
        unregisterOverlay(overlayIdRef.current)
      }
    }, [open, registerOverlay, unregisterOverlay])

    return (
      <TooltipProvider delayDuration={delayDuration}>
        <TooltipRoot open={open} onOpenChange={setOpen}>
          <TooltipTrigger ref={ref} asChild>
            {children}
          </TooltipTrigger>
          <TooltipContent side={side} align={align} className={className}>
            {content}
          </TooltipContent>
        </TooltipRoot>
      </TooltipProvider>
    )
  }
)
Tooltip.displayName = 'Tooltip'

export { Tooltip, TooltipRoot, TooltipTrigger, TooltipContent, TooltipProvider }
