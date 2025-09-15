/**
 * @file Main application settings component
 */
import { Eye, LogIn, Settings, Monitor, Users, Bug } from 'lucide-react';
import React from 'react';

import { useMainSettingsStore } from '../../shared/store/mainSettingsStore';
import { Button } from '../../shared/ui/button';
import { Card, CardContent } from '../../shared/ui/card';
import { SettingsSection } from '../../shared/ui/settings-section';
import { Tooltip } from '../../shared/ui/tooltip';
import { cn } from '../../shared/utils/utils';

interface MainSettingsProps {
  className?: string;
}

/**
 * Interface settings section
 */
const InterfaceSettings: React.FC = () => {
  const { settings, setHideEventLogger, setCompactAccountView, setDebugMode } = useMainSettingsStore();

  return (
    <SettingsSection title="Interface" icon={Monitor}>
        <Tooltip content="Completely hide the event logger panel from the interface">
          <Button
            type="button"
            onClick={() => setHideEventLogger(!settings.hideEventLogger)}
            variant={settings.hideEventLogger ? 'default' : 'outline'}
            size="sm"
            className="w-full gap-1.5 h-7 text-xs justify-start"
          >
            <Eye size={12} />
            Hide Event Logger
          </Button>
        </Tooltip>

        <Tooltip content="Show accounts in compact view with reduced height">
          <Button
            type="button"
            onClick={() => setCompactAccountView(!settings.compactAccountView)}
            variant={settings.compactAccountView ? 'default' : 'outline'}
            size="sm"
            className="w-full gap-1.5 h-7 text-xs justify-start"
          >
            <Eye size={12} />
            Compact Account View
          </Button>
        </Tooltip>

        <Tooltip content="Enable debug mode to show detailed diagnostic logs in console">
          <Button
            type="button"
            onClick={() => setDebugMode(!settings.debugMode)}
            variant={settings.debugMode ? 'default' : 'outline'}
            size="sm"
            className="w-full gap-1.5 h-7 text-xs justify-start"
          >
            <Bug size={12} />
            Debug Log
          </Button>
        </Tooltip>
    </SettingsSection>
  );
};

/**
 * Account settings section
 */
const AccountSettings: React.FC = () => {
  const { settings, setAutoLoginOnStartup } = useMainSettingsStore();

  return (
    <SettingsSection title="Accounts" icon={Users}>
        <Tooltip content="Automatically connect to all accounts when the application starts">
          <Button
            type="button"
            onClick={() => setAutoLoginOnStartup(!settings.autoLoginOnStartup)}
            variant={settings.autoLoginOnStartup ? 'default' : 'outline'}
            size="sm"
            className="w-full gap-1.5 h-7 text-xs justify-start"
          >
            <LogIn size={12} />
            Auto-Login on Startup
          </Button>
        </Tooltip>
    </SettingsSection>
  );
};

/**
 * Main settings component for core application configuration
 */
const MainSettings: React.FC<MainSettingsProps> = ({ className }) => {
  return (
    <div className={cn("flex flex-col h-full max-w-2xl mx-auto", className)}>
      <Card className="mb-4 border-0 shadow-none">
        <CardContent className="px-3 md:px-4 lg:px-6">
          <h4 className="text-sm font-medium mb-3 flex items-center justify-center gap-2">
            <Settings size={16} className="text-muted-foreground" />
            Main Settings
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <InterfaceSettings />
            <AccountSettings />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MainSettings;
