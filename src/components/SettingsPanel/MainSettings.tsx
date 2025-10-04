/**
 * @file Unified component for main application settings
 * @description Modernized main settings in ProxyConfiguration style with Switches, tooltip-icons and gradient headers. Includes Interface and Account sections without SettingsSection frames in unified modern style.
 */
import { Eye, Github, Info, LogIn, Minimize2, Settings } from 'lucide-react'
import type React from 'react'

import { useMainSettingsStore } from '../../shared/store/mainSettingsStore'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Label } from '../../shared/ui/label'
import { Switch } from '../../shared/ui/switch'
import { Tooltip } from '../../shared/ui/tooltip'
import { cn } from '../../shared/utils/utils'

interface MainSettingsProps {
  className?: string
}

/**
 * Interface settings section
 */
const InterfaceSettings: React.FC = () => {
  const settings = useMainSettingsStore(state => state.settings)
  const updateSettings = useMainSettingsStore(state => state.updateSettings)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between h-8">
        <div className="flex items-center gap-2">
          <Tooltip content="Completely hide the event logger panel from the interface">
            <Info size={14} className="text-muted-foreground cursor-help" />
          </Tooltip>
          <Label htmlFor="hide-logger" className="text-sm">
            Hide Event Logger
          </Label>
        </div>
        <Switch
          id="hide-logger"
          checked={settings.hideEventLogger}
          onCheckedChange={checked => {
            void updateSettings({ hideEventLogger: checked })
          }}
        />
      </div>

      <div className="flex items-center justify-between h-8">
        <div className="flex items-center gap-2">
          <Tooltip content="Show accounts in compact view with reduced height">
            <Eye size={14} className="text-muted-foreground cursor-help" />
          </Tooltip>
          <Label htmlFor="compact-view" className="text-sm">
            Compact Account View
          </Label>
        </div>
        <Switch
          id="compact-view"
          checked={settings.compactAccountView}
          onCheckedChange={checked => {
            void updateSettings({ compactAccountView: checked })
          }}
        />
      </div>

      <div className="flex items-center justify-between h-8">
        <div className="flex items-center gap-2">
          <Tooltip content="Minimize to system tray instead of taskbar when closing the window">
            <Minimize2 size={14} className="text-muted-foreground cursor-help" />
          </Tooltip>
          <Label htmlFor="minimize-tray" className="text-sm">
            Minimize to Tray
          </Label>
        </div>
        <Switch
          id="minimize-tray"
          checked={settings.minimizeToTray}
          onCheckedChange={checked => {
            void updateSettings({ minimizeToTray: checked })
          }}
        />
      </div>
    </div>
  )
}

/**
 * Account settings section
 */
const AccountSettings: React.FC = () => {
  const settings = useMainSettingsStore(state => state.settings)
  const updateSettings = useMainSettingsStore(state => state.updateSettings)

  return (
    <div>
      <div className="flex items-center justify-between h-8">
        <div className="flex items-center gap-2">
          <Tooltip content="Automatically connect to all accounts when the application starts">
            <LogIn size={14} className="text-muted-foreground cursor-help" />
          </Tooltip>
          <Label htmlFor="auto-login" className="text-sm">
            Auto-Login on Startup
          </Label>
        </div>
        <Switch
          id="auto-login"
          checked={settings.autoLoginOnStartup}
          onCheckedChange={checked => {
            void updateSettings({ autoLoginOnStartup: checked })
          }}
        />
      </div>
    </div>
  )
}

/**
 * GitHub button component with modern design
 */
const GitHubButton: React.FC = () => {
  const handleGitHubClick = (): void => {
    // Use ipcApi.openExternal to open in system browser
    if (window.ipcApi?.openExternal) {
      void window.ipcApi.openExternal('https://github.com/HALDRO/IMAP-Viewer')
    } else {
      // Fallback for web version
      window.open('https://github.com/HALDRO/IMAP-Viewer', '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="flex justify-center pt-6">
      <button
        type="button"
        onClick={handleGitHubClick}
        className="group relative inline-flex items-center justify-center px-12 py-4 text-base font-bold text-white bg-black border-2 border-purple-500 rounded-lg transition-all duration-200 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/25 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 focus:ring-offset-background w-64"
        style={{
          boxShadow: '0 0 0 1px rgba(168, 85, 247, 0.3), 0 0 8px rgba(168, 85, 247, 0.2)',
        }}
      >
        <Github size={20} className="mr-3" />
        <span>GitHub</span>
        <span className="ml-1">.</span>
      </button>
    </div>
  )
}

/**
 * Main settings component for core application configuration
 */
const MainSettings: React.FC<MainSettingsProps> = ({ className }) => {
  return (
    <div className={cn('flex flex-col gap-3 h-full w-full', className)}>
      <Card className="border-border bg-card shadow-lg">
        <CardContent className="p-0 h-full">
          <div className="h-full overflow-hidden">
            <div className="px-3 md:px-4 lg:px-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-medium flex items-center gap-2">
                  <Settings size={20} className="text-purple-500" />
                  <span className="bg-linear-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent font-semibold">
                    Main Settings
                  </span>
                </h4>
              </div>

              <div className="space-y-1">
                {/* Interface Settings */}
                <InterfaceSettings />

                {/* Account Settings */}
                <AccountSettings />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GitHub Button - separate at bottom */}
      <GitHubButton />
    </div>
  )
}

export default MainSettings
