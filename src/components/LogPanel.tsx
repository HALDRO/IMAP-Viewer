/**
 * @file A persistent sidebar panel for displaying application logs.
 */
import { Bug, ChevronDown, ChevronUp, Terminal, Trash2 } from 'lucide-react'
import pino from 'pino'
import React, { useState } from 'react'

import { useLogStore } from '../shared/store/logStore'
import { useMainSettingsStore } from '../shared/store/mainSettingsStore'
import { useUIStore } from '../shared/store/uiStore'
import { Button } from '../shared/ui/button'
import { ScrollArea } from '../shared/ui/scroll-area'

const logColors: Record<string, { text: string; dot: string }> = {
  success: {
    text: 'text-green-400',
    dot: 'bg-green-500',
  },
  error: {
    text: 'text-destructive',
    dot: 'bg-destructive',
  },
  fatal: {
    text: 'text-destructive',
    dot: 'bg-destructive',
  },
  info: {
    text: 'text-primary',
    dot: 'bg-primary',
  },
  warn: {
    text: 'text-yellow-400',
    dot: 'bg-yellow-500',
  },
  debug: {
    text: 'text-gray-400',
    dot: 'bg-gray-500',
  },
  trace: {
    text: 'text-gray-500',
    dot: 'bg-gray-600',
  },
  default: {
    text: 'text-gray-400',
    dot: 'bg-gray-500',
  },
}

/**
 * Compact time formatter - returns only hours:minutes:seconds
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/**
 * Log panel component that displays application events and messages in a compact format
 */
const LogPanel = (): React.JSX.Element => {
  const logs = useLogStore(state => state.logs)
  const clearLogs = useLogStore(state => state.clearLogs)
  const isLogPanelCollapsed = useUIStore(state => state.isLogPanelCollapsed)
  const toggleLogPanel = useUIStore(state => state.toggleLogPanel)
  const settings = useMainSettingsStore(state => state.settings)
  const [showDebugLogs, setShowDebugLogs] = useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Filter logs based on debug mode
  const filteredLogs = React.useMemo(() => {
    if (!showDebugLogs) {
      // Show regular logs (exclude debug logs with DEBUG prefix)
      return logs.filter(log => !log.msg.includes('DEBUG:'))
    }
    // Show only debug logs (with DEBUG prefix)
    return logs.filter(log => log.msg.includes('DEBUG:'))
  }, [logs, showDebugLogs])

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  return (
    <div className="h-full flex flex-col bg-background text-foreground w-full">
      <div className="flex items-center justify-between py-1 px-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Terminal size={14} className="text-muted-foreground" />
          <h3 className="text-xs font-medium">{showDebugLogs ? 'Debug Logs' : 'Event Log'}</h3>
          {settings.debugMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDebugLogs(!showDebugLogs)}
              className="h-6 px-2 text-xs"
            >
              <Bug size={12} className="mr-1" />
              {showDebugLogs ? 'Events' : 'Debug'}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLogPanel}
            title={isLogPanelCollapsed ? 'Expand log panel' : 'Collapse log panel'}
            className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            {isLogPanelCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearLogs}
            title="Clear logs"
            className="h-6 w-6 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <ScrollArea className="grow px-1 py-0.5 font-mono text-xs space-y-0.5">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 italic p-1 text-center text-xs">
            {showDebugLogs
              ? 'No debug logs yet. Enable debug mode and interact with the application.'
              : 'No events recorded yet.'}
          </div>
        ) : (
          filteredLogs.map(log => {
            const levelName =
              typeof log.level === 'number' ? pino.levels.labels[log.level] || 'default' : log.level
            const colors = logColors[levelName] ?? logColors.default
            const time = formatTime(log.timestamp)

            // Clean debug message by removing the DEBUG: prefix
            const displayMessage = showDebugLogs ? log.msg.replace('DEBUG:', '').trim() : log.msg

            return (
              <div
                key={log.id}
                className="flex items-center gap-1.5 py-0.5 px-1 hover:bg-white/5 rounded group"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} shrink-0`} />
                <span className="text-gray-400 text-[10px] shrink-0 opacity-70 group-hover:opacity-100">
                  {time}
                </span>
                <p
                  className={`text-gray-200 text-[11px] ${levelName === 'error' || levelName === 'fatal' ? '' : 'truncate'}`}
                >
                  {displayMessage}
                </p>
              </div>
            )
          })
        )}
      </ScrollArea>
    </div>
  )
}

export default LogPanel
