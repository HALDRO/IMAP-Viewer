/**
 * @file Component that shows a loading skeleton for the email list.
 */
import type React from 'react'

interface EmailListSkeletonProps {
  count?: number
}

/**
 * Skeleton loader component for the email list when emails are being fetched
 */
const EmailListSkeleton: React.FC<EmailListSkeletonProps> = ({ count = 10 }) => {
  return (
    <output
      className="animate-pulse bg-background text-foreground h-full"
      aria-label="Loading emails"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Static list, index is fine for key
          key={`skeleton-item-${index}`}
          className="p-3 border-b border-gray-800/20 flex items-start gap-3"
          aria-hidden="true"
        >
          {/* Checkbox placeholder */}
          <div className="flex items-center h-6 pt-0.5">
            <div className="w-4 h-4 rounded bg-gray-800/60" />
          </div>

          <div className="grow min-w-0">
            {/* From & Date row */}
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gray-800/60" />
                <div className="h-4 w-32 bg-gray-800/60 rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-16 bg-gray-800/60 rounded-full" />
              </div>
            </div>

            {/* Subject line */}
            <div className="h-4 bg-gray-800/60 rounded-full w-3/4 mb-2" />

            {/* Message preview */}
            <div className="h-3 bg-gray-800/40 rounded-full w-1/2" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading email list...</span>
    </output>
  )
}

export default EmailListSkeleton
