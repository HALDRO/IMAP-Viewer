/**
 * @file Universal settings section component with centered headers
 * @description Redesigned section component with centered headers and descriptions. Ensures consistent appearance of all settings sections with icons, titles and content. Automatically adapts to content and supports optional descriptions.
 */

import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'

import { cn } from '../utils/utils'

export interface SettingsSectionProps {
  /** Section title */
  title: string
  /** Icon component from lucide-react */
  icon: LucideIcon
  /** Optional description text */
  description?: string
  /** Section content */
  children: React.ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * Universal settings section component with consistent header and styling
 *
 * @example
 * ```tsx
 * <SettingsSection title="Connection" icon={Shield} description="Connection settings">
 *   <Button>Random</Button>
 *   <Input label="Max Retries" />
 * </SettingsSection>
 * ```
 */
export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  icon: Icon,
  description,
  children,
  className,
}) => {
  return (
    <div className={cn('rounded-lg border border-border/50', className)}>
      {/* Section Header */}
      <div
        style={{
          paddingTop: '3px',
          paddingBottom: '5px',
          paddingLeft: '12px',
          paddingRight: '12px',
        }}
      >
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1.5">
          <Icon size={12} className="text-muted-foreground" />
          {title}
        </h5>
        {description && (
          <p className="text-xs text-muted-foreground/80 mt-1 text-center">{description}</p>
        )}
      </div>

      {/* Section Content */}
      <div className="space-y-2 px-3 pb-2">{children}</div>
    </div>
  )
}
