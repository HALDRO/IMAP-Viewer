/**
 * @file Drag and drop zone component for importing account files
 * @description Wrapper component that handles file drag-and-drop functionality.
 * Supports ref forwarding for positioning calculations in collapsed mode.
 * Accepts .txt and .csv files for account import.
 */
import React from 'react'

interface DragDropZoneProps {
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  children: React.ReactNode
  className?: string
}

export interface ImportResult {
  addedCount: number
  skippedCount: number
  error?: string
}

export const DragDropZone = React.forwardRef<HTMLDivElement, DragDropZoneProps>(
  ({ isDragOver, onDragOver, onDragLeave, onDrop, children, className = '' }, ref) => {
    return (
      <div
        ref={ref}
        className={`${className} ${isDragOver ? 'bg-secondary border-r border-primary' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {children}
      </div>
    )
  }
)

DragDropZone.displayName = 'DragDropZone'

// Hook for drag and drop functionality
export const useDragDrop = (
  onImportComplete: (result: ImportResult) => void
): {
  isDragOver: boolean
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
} => {
  const [isDragOver, setIsDragOver] = React.useState(false)

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = React.useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      const textFile = files.find(
        file =>
          file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.csv')
      )

      if (textFile) {
        void (async (): Promise<void> => {
          try {
            // Read file content using FileReader
            const fileContent = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = (e): void => resolve(e.target?.result as string)
              reader.onerror = reject
              reader.readAsText(textFile)
            })

            // Create a temporary file and import
            const result = await window.ipcApi.importFromFileContent(fileContent)
            if (typeof result.error === 'undefined' || result.error === null) {
              onImportComplete(result)
            }
          } catch {
            // Handle error silently or use proper error reporting
          }
        })()
      }
    },
    [onImportComplete]
  )

  return {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}
