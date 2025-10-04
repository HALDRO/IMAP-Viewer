/**
 * @file Action buttons component for account management panel with fixed 56px height
 * @description Container for "Add" and "Import" buttons, integrated into AccountManagerPanel.
 *
 * FEATURES:
 * - Fixed 56px container height in both collapsed and expanded modes
 * - Collapsed mode: ultra-compact 24x24px icon buttons (h-6 w-6) with 13px icons
 *   Outer container: px-1.5 (6px horiz)
 *   Inner container: py-1.5 px-1 (6px vert, 4px horiz), gap-0.5 (2px between buttons)
 *   Total min width: ~58px (guaranteed fit on extremely narrow screens)
 *   Buttons use min-w-6 min-h-6 and shrink-0 to prevent compression
 * - Expanded mode: 36px height buttons (h-9) with 16px icons and text-sm
 *   Container padding: py-1 px-1.5 (4px vert, 6px horiz), gap-1.5 (6px between buttons)
 * - Collapsed: extreme compactness with max-w-full ensures content never overflows
 * - Expanded: minimal vertical padding to maximize button height
 * - 1px top border (border-t) in both modes
 * - Button background bg-muted/30 rounded-lg for visual grouping
 * - Adapts to display mode: collapsed (icons only) or expanded (buttons with text)
 * - In collapsed mode uses Portal for rendering outside narrow Panel container
 * - Integrated inside AccountManagerPanel for unified visual structure
 * - Width automatically matches parent container via getBoundingClientRect()
 * - ResizeObserver tracks container size changes for real-time synchronization during panel resizing
 *
 * Structure ensures consistency with account panel design and proper adaptation to panel width.
 * Portal container updates automatically on window resize and panel resize events.
 */
import { PlusCircle, Upload } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '../../shared/ui/button'

interface ActionButtonsProps {
  onAddNew: () => void | Promise<void>
  onImport: () => void | Promise<void>
  isDragOver: boolean
  collapsed?: boolean
  containerRef?: React.RefObject<HTMLDivElement>
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onAddNew,
  onImport,
  isDragOver,
  collapsed = false,
  containerRef,
}) => {
  const [position, setPosition] = useState<{ bottom: number; right: number; width: number } | null>(
    null
  )
  const updatePositionRef = useRef<number | null>(null)
  const retryCountRef = useRef(0)

  // Update position for Portal in collapsed mode with multiple retry attempts
  useEffect(() => {
    if (!collapsed || !containerRef?.current) {
      setPosition(null)
      retryCountRef.current = 0
      return
    }

    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        // Check that rect is valid (non-zero)
        if (rect.width > 0 && rect.height > 0) {
          setPosition({
            bottom: window.innerHeight - rect.bottom,
            right: window.innerWidth - rect.right,
            width: rect.width,
          })
          retryCountRef.current = 0
        } else if (retryCountRef.current < 10) {
          // If dimensions are zero, try again after short interval
          retryCountRef.current++
          updatePositionRef.current = window.setTimeout(updatePosition, 100)
        }
      }
    }

    // Multiple attempts with increasing intervals for reliability
    const timeouts: number[] = []
    timeouts.push(window.setTimeout(updatePosition, 0)) // Immediately
    timeouts.push(window.setTimeout(updatePosition, 50)) // After 50ms
    timeouts.push(window.setTimeout(updatePosition, 150)) // After 150ms
    timeouts.push(window.setTimeout(updatePosition, 300)) // After 300ms

    // Update on window resize
    window.addEventListener('resize', updatePosition)

    // Watch for container size changes (panel resizing)
    const resizeObserver = new ResizeObserver(() => {
      updatePosition()
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      timeouts.forEach(clearTimeout)
      if (updatePositionRef.current) {
        clearTimeout(updatePositionRef.current)
      }
      window.removeEventListener('resize', updatePosition)
      resizeObserver.disconnect()
    }
  }, [collapsed, containerRef])
  // Base classes for container in account panel
  const baseClasses = 'flex items-center justify-between px-2 box-border'

  // Border classes for account panel
  const borderClasses = 'border-t border-border'

  const containerClasses = `${baseClasses} ${borderClasses}`

  // Static container style with fixed 56px height
  const containerStyle = {
    height: '56px',
    boxSizing: 'border-box' as const,
  }

  // Collapsed mode (icons only) for account panel - render via Portal
  if (collapsed && position) {
    const content = (
      <div
        className="fixed flex items-center justify-center"
        style={{
          bottom: position.bottom,
          right: position.right,
          width: position.width,
          height: '56px',
          zIndex: 9999,
          pointerEvents: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="border-t border-border w-full flex items-center justify-center px-1.5 pointer-events-auto bg-background"
          style={{ height: '56px', boxSizing: 'border-box' }}
        >
          <div className="flex items-center gap-0.5 bg-muted/30 rounded-lg py-1.5 px-1 pointer-events-auto max-w-full">
            <Button
              variant="ghost"
              size="icon"
              onClick={e => {
                e.stopPropagation()
                void onAddNew()
              }}
              title="Add account"
              aria-label="Add new account"
              className="h-6 w-6 min-w-6 min-h-6 rounded-full pointer-events-auto cursor-pointer shrink-0"
              style={{ pointerEvents: 'auto' }}
            >
              <PlusCircle size={13} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={e => {
                e.stopPropagation()
                void onImport()
              }}
              title={isDragOver ? 'Drop file to import' : 'Import account list'}
              aria-label="Import account list"
              className={`h-6 w-6 min-w-6 min-h-6 rounded-full transition-colors pointer-events-auto cursor-pointer shrink-0 ${
                isDragOver ? 'bg-primary/20 text-primary' : ''
              }`}
              style={{ pointerEvents: 'auto' }}
            >
              <Upload size={13} />
            </Button>
          </div>
        </div>
      </div>
    )
    return createPortal(content, document.body)
  }

  // Placeholder in collapsed mode while position is being calculated
  if (collapsed) {
    return (
      <div className={containerClasses} style={containerStyle}>
        {/* Empty placeholder to preserve space in layout */}
      </div>
    )
  }

  // Expanded mode (buttons with text) for account panel
  return (
    <div className={containerClasses} style={containerStyle}>
      {/* Buttons with background occupy full width */}
      <div className="flex items-center gap-1.5 w-full bg-muted/30 rounded-lg py-1 px-1.5">
        <Button
          onClick={() => {
            void onAddNew()
          }}
          size="sm"
          className="flex-1 h-9 gap-2 rounded-md min-w-0 px-4 text-sm"
          variant="secondary"
          title="Add new account"
        >
          <PlusCircle size={16} className="shrink-0" />
          <span className="truncate">Add</span>
        </Button>
        <Button
          onClick={() => {
            void onImport()
          }}
          size="sm"
          className={`flex-1 h-9 gap-2 rounded-md min-w-0 px-4 text-sm transition-colors ${
            isDragOver ? 'bg-primary/20 text-primary' : ''
          }`}
          variant="ghost"
          title={isDragOver ? 'Drop file to import' : 'Import account list'}
        >
          <Upload size={16} className="shrink-0" />
          <span className="truncate">Import</span>
        </Button>
      </div>
    </div>
  )
}
