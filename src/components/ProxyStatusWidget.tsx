/**
 * @file Proxy status widget for sidebar with quick toggle
 * @description Simple widget showing proxy on/off state with toggle switch.
 * Displays proxy details (type, host:port, IP) only in tooltip on hover.
 * Allows quick enable/disable without navigating to settings. Fixed at bottom of left sidebar.
 */
import { Globe } from 'lucide-react'
import type React from 'react'
import { useCallback } from 'react'

import { useProxyManager } from '../shared/hooks/useProxyManager'
import { useProxyStatus } from '../shared/hooks/useProxyStatus'
import { useUIStore } from '../shared/store/uiStore'
import { Switch } from '../shared/ui/switch'
import { Tooltip } from '../shared/ui/tooltip'
import { cn } from '../shared/utils/utils'

interface ProxyStatusWidgetProps {
  collapsed?: boolean
}

/**
 * Sidebar widget for proxy status and quick toggle
 */
export const ProxyStatusWidget: React.FC<ProxyStatusWidgetProps> = ({ collapsed = false }) => {
  const { externalIp, config: rawConfig } = useProxyStatus()
  const { handleSetProxy, selectedProxyIndex, enableProxies } = useProxyManager()
  const { openSettings, closeSettings, isSettingsOpen } = useUIStore()

  const config = rawConfig as { enabled?: boolean; type?: string; hostPort?: string } | null

  const handleToggle = useCallback(
    async (checked: boolean) => {
      try {
        if (checked) {
          await handleSetProxy(selectedProxyIndex ?? 0)
        } else {
          await handleSetProxy(null)
        }
      } catch (error) {
        console.error('Failed to toggle proxy:', error)
      }
    },
    [handleSetProxy, selectedProxyIndex]
  )

  const handleToggleSettings = useCallback(() => {
    if (isSettingsOpen) {
      closeSettings()
    } else {
      openSettings('proxy')
    }
  }, [isSettingsOpen, openSettings, closeSettings])

  // Build tooltip content with details (only shown on hover)
  const tooltipContent = (() => {
    if (!config?.enabled) {
      return 'Proxy is disabled'
    }

    const parts: string[] = []

    if (config.type) {
      parts.push(`Type: ${config.type.toUpperCase()}`)
    }

    if (config.hostPort) {
      parts.push(`Server: ${config.hostPort}`)
    }

    if (externalIp) {
      parts.push(`IP: ${externalIp}`)
    }

    return parts.length > 0 ? parts.join('\n') : 'Proxy is enabled'
  })()

  // Collapsed icon-only view
  if (collapsed) {
    return (
      <div className="flex items-center justify-center py-2 border-t border-border">
        <Tooltip
          content={
            <div className="text-xs whitespace-pre-line">
              <div className="font-medium mb-1">{enableProxies ? 'Proxy On' : 'Proxy Off'}</div>
              <div className="text-muted-foreground">{tooltipContent}</div>
            </div>
          }
          side="right"
        >
          <button
            type="button"
            onClick={handleToggleSettings}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
              enableProxies ? 'bg-green-500/20 hover:bg-green-500/30' : 'bg-muted hover:bg-muted/80'
            )}
          >
            <Globe
              size={18}
              className={enableProxies ? 'text-green-500' : 'text-muted-foreground'}
            />
          </button>
        </Tooltip>
      </div>
    )
  }

  // Expanded view with full controls
  return (
    <div className="bg-background">
      <Tooltip
        content={
          <div className="text-xs max-w-xs whitespace-pre-line">
            <div className="font-medium mb-1">{enableProxies ? 'Proxy On' : 'Proxy Off'}</div>
            <div className="text-muted-foreground">{tooltipContent}</div>
            <div className="text-muted-foreground mt-2 text-[10px]">Click to open settings</div>
          </div>
        }
        side="right"
      >
        <div className="px-3 flex items-center h-component-lg border-t border-border">
          <div className="flex items-center justify-between gap-2">
            {/* Label */}
            <button
              type="button"
              onClick={handleToggleSettings}
              className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80 transition-opacity"
            >
              <Globe
                size={16}
                className={cn(
                  'flex-shrink-0',
                  enableProxies ? 'text-green-500' : 'text-muted-foreground'
                )}
              />
              <span className="text-xs font-medium truncate w-full">
                {enableProxies ? 'Proxy On' : 'Proxy Off'}
              </span>
            </button>

            {/* Toggle switch */}
            <Switch
              checked={enableProxies}
              onCheckedChange={handleToggle}
              className="flex-shrink-0"
            />
          </div>
        </div>
      </Tooltip>
    </div>
  )
}
