/**
 * @file Unified top bar component for consistent application header
 */
import type React from 'react'

import { cn } from '../utils/utils'

interface TopBarProps {
  children: React.ReactNode
  className?: string
}

/**
 * Main top bar container that spans the full width of the application
 */
export const TopBar: React.FC<TopBarProps> = ({ children, className }) => {
  return (
    <header
      className={cn(
        // Layout - using CSS Grid for better performance
        'grid grid-cols-[auto_1fr_auto] items-center',
        'w-full h-14 px-4 gap-4',
        'border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60',
        'sticky top-0 z-50',

        // Custom classes
        className
      )}
    >
      {children}
    </header>
  )
}

interface TopBarSectionProps {
  children: React.ReactNode
  className?: string
  side?: 'left' | 'center' | 'right'
  style?: React.CSSProperties
}

/**
 * Section container for organizing top bar content
 * Uses CSS Grid for optimal performance
 */
export const TopBarSection: React.FC<TopBarSectionProps> = ({
  children,
  className,
  side,
  style,
}) => {
  const sideStyles = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }

  return (
    <div
      className={cn('flex items-center gap-3', side && sideStyles[side], className)}
      style={style}
    >
      {children}
    </div>
  )
}

interface TopBarTitleProps {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Title component for the top bar
 */
export const TopBarTitle: React.FC<TopBarTitleProps> = ({ children, className, size = 'lg' }) => {
  const sizeStyles = {
    sm: 'text-sm font-medium',
    md: 'text-base font-semibold',
    lg: 'text-lg font-semibold',
  }

  return <h1 className={cn(sizeStyles[size], 'text-foreground', className)}>{children}</h1>
}
