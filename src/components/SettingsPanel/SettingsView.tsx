/**
 * @file Component for displaying settings directly in the main content area
 * @description Settings panel with tabbed navigation (Main/Proxy), keyboard shortcuts (Escape to close),
 * and action buttons (reset config, close). Uses shadcn Tabs for consistent UI and proper accessibility.
 * Implements cleanup for event listeners to prevent memory leaks.
 */
import { Globe, RotateCcw, Settings, X } from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'

import { useUIStore } from '../../shared/store/uiStore'
import { Button } from '../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog'
import { ScrollArea } from '../../shared/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '../../shared/ui/tabs'
import { Tooltip } from '../../shared/ui/tooltip'

import MainSettings from './MainSettings'
import ProxySettings from './ProxySettings'

const SettingsView: React.FC = () => {
  const settingsTab = useUIStore(state => state.settingsTab)
  const setSettingsTab = useUIStore(state => state.setSettingsTab)
  const closeSettings = useUIStore(state => state.closeSettings)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const resetConfig = useUIStore(state => state.resetConfig)

  // Use settingsTab from store with fallback to 'main'
  // Handle null, undefined, empty string, or invalid values
  const activeTab =
    settingsTab && (settingsTab === 'main' || settingsTab === 'proxy') ? settingsTab : 'main'

  const handleResetConfig = (): void => {
    resetConfig()
    setShowResetDialog(false)
  }

  // Type-safe wrapper for onValueChange - validates tab value before setting
  const handleTabChange = (value: string): void => {
    if (value === 'main' || value === 'proxy') {
      setSettingsTab(value)
    }
  }

  // Keyboard shortcut: Escape to close settings
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !showResetDialog) {
        closeSettings()
      }
    }

    window.addEventListener('keydown', handleEscapeKey)
    return (): void => {
      window.removeEventListener('keydown', handleEscapeKey)
    }
  }, [closeSettings, showResetDialog])

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex items-center justify-center border-b border-border bg-background/95 backdrop-blur h-12 min-h-12 max-h-12 flex-shrink-0 px-4 relative"
      >
        <TabsList className="h-9">
          <TabsTrigger
            value="main"
            className="gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary dark:data-[state=active]:text-primary"
          >
            <Settings size={16} />
            Main
          </TabsTrigger>
          <TabsTrigger
            value="proxy"
            className="gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary dark:data-[state=active]:text-primary"
          >
            <Globe size={16} />
            Proxy
          </TabsTrigger>
        </TabsList>

        {/* Action buttons - positioned absolutely to the right */}
        <div className="absolute right-4 flex items-center gap-1">
          <Tooltip
            content="Reset all settings to default (cannot be undone)"
            side="bottom"
            align="end"
          >
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowResetDialog(true)}
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <RotateCcw size={16} />
            </Button>
          </Tooltip>

          <Tooltip content="Close settings (Esc)" side="bottom" align="end">
            <Button variant="outline" size="icon" onClick={closeSettings} className="h-8 w-8">
              <X size={16} />
            </Button>
          </Tooltip>
        </div>
      </Tabs>

      {/* Content */}
      <ScrollArea className="flex-1 bg-background">
        <div className="px-12 py-4 max-w-3xl mx-auto">
          {activeTab === 'main' && <MainSettings />}
          {activeTab === 'proxy' && <ProxySettings />}
        </div>
      </ScrollArea>

      {/* Reset Configuration Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset all settings to default? This will reset panel sizes,
              positions, and all UI preferences. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetConfig}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SettingsView
