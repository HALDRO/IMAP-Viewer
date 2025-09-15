/**
 * @file Proxy advanced settings component
 */
import { Shield } from 'lucide-react';
import React from 'react';

import { Card, CardContent } from '../../shared/ui/card';

import { ConnectionSettings, ListManagement, SourceManagement } from './ProxyAdvancedSettingsComponents';

interface ProxyAdvancedSettingsProps {
  // Connection settings
  useRandomProxy: boolean;
  setUseRandomProxy: (_value: boolean) => void;
  maxRetries: number;
  setMaxRetries: (_value: number) => void;

  // Source settings
  randomizeSource: boolean;
  setRandomizeSource: (_value: boolean) => void;
  sourceUrl: string;
  setSourceUrl: (_value: string) => void;
  autoUpdateEnabled: boolean;
  setAutoUpdateEnabled: (_value: boolean) => void;
  updateInterval: number;
  setUpdateInterval: (_value: number) => void;

  // List management
  showImport: boolean;
  setShowImport: (_value: boolean) => void;
  handleTestAllProxies: () => Promise<void>;
  handleExport: () => void;
  isLoading: boolean;
  proxiesCount: number;
}

/**
 * Advanced settings component for proxy configuration
 */
export const ProxyAdvancedSettings: React.FC<ProxyAdvancedSettingsProps> = ({
  useRandomProxy,
  setUseRandomProxy,
  maxRetries,
  setMaxRetries,
  randomizeSource,
  setRandomizeSource,
  sourceUrl,
  setSourceUrl,
  autoUpdateEnabled,
  setAutoUpdateEnabled,
  updateInterval,
  setUpdateInterval,
  showImport,
  setShowImport,
  handleTestAllProxies,
  handleExport,
  isLoading,
  proxiesCount
}) => {
  return (
    <Card className="mb-4 border-0 shadow-none">
      <CardContent className="px-3 md:px-4 lg:px-6">
        <h4 className="text-sm font-medium mb-3 flex items-center justify-center gap-2">
          <Shield size={16} className="text-muted-foreground" />
          Advanced Settings
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <ConnectionSettings
            useRandomProxy={useRandomProxy}
            setUseRandomProxy={setUseRandomProxy}
            maxRetries={maxRetries}
            setMaxRetries={setMaxRetries}
          />

          <SourceManagement
            randomizeSource={randomizeSource}
            setRandomizeSource={setRandomizeSource}
            sourceUrl={sourceUrl}
            setSourceUrl={setSourceUrl}
            autoUpdateEnabled={autoUpdateEnabled}
            setAutoUpdateEnabled={setAutoUpdateEnabled}
            updateInterval={updateInterval}
            setUpdateInterval={setUpdateInterval}
          />

          <ListManagement
            showImport={showImport}
            setShowImport={setShowImport}
            handleTestAllProxies={handleTestAllProxies}
            handleExport={handleExport}
            isLoading={isLoading}
            proxiesCount={proxiesCount}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ProxyAdvancedSettings;
