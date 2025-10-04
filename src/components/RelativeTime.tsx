import { Clock } from 'lucide-react'
import type React from 'react'

import { useRelativeTime } from '../shared/hooks/useRelativeTime'

interface RelativeTimeProps {
  dateString: string
  className?: string
  showIcon?: boolean
  showTooltip?: boolean
  maxRelativeTime?: number // in milliseconds
  showOnlyRelative?: boolean // if true, only show relative time, don't fall back to absolute
}

const RelativeTime: React.FC<RelativeTimeProps> = ({
  dateString,
  className = '',
  showIcon = false,
  showTooltip = true,
  maxRelativeTime = 24 * 60 * 60 * 1000, // 24 hours
  showOnlyRelative = false,
}) => {
  const { relativeTime, absoluteTime, showRelative } = useRelativeTime(dateString, {
    maxRelativeTime,
    updateInterval: 1000, // Update every second
  })

  // If showOnlyRelative is true, always show relative time regardless of age
  const shouldShowRelative = showOnlyRelative || showRelative
  const displayTime = shouldShowRelative ? relativeTime : absoluteTime
  const tooltipTime = shouldShowRelative ? absoluteTime : relativeTime

  // Don't render anything if showOnlyRelative is true but the email is too old
  if (showOnlyRelative && !showRelative) {
    return null
  }

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={showTooltip ? tooltipTime : undefined}
    >
      {showIcon && <Clock className="w-3 h-3" />}
      <span className={shouldShowRelative ? 'text-blue-400' : ''}>{displayTime}</span>
    </span>
  )
}

export default RelativeTime
