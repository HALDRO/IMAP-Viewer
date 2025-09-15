/**
 * @file Proxy advanced settings sub-components
 */
import { Download, RefreshCw, RotateCcw, Shield, Upload, Globe, Settings } from 'lucide-react';
import React from 'react';

import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Tooltip } from '../../shared/ui/tooltip';
import { SettingsSection } from '../../shared/ui/settings-section';

/**
 * Connection settings section
 */
export const ConnectionSettings: React.FC<{
  useRandomProxy: boolean;
  setUseRandomProxy: (value: boolean) => void;
  maxRetries: number;
  setMaxRetries: (value: number) => void;
}> = ({ useRandomProxy, setUseRandomProxy, maxRetries, setMaxRetries }) => (
  <SettingsSection title="Connection" icon={Shield}>
      <Tooltip content="Use random proxy for each connection attempt">
        <Button
          type="button"
          onClick={() => setUseRandomProxy(!useRandomProxy)}
          variant={useRandomProxy ? 'default' : 'outline'}
          size="sm"
          className="w-full gap-1.5 h-7 text-xs justify-start"
        >
          <Shield size={12} />
          Random
        </Button>
      </Tooltip>

      <Tooltip content="Number of retry attempts before giving up">
        <Input
          type="number"
          label="Max Retries"
          floatingLabel
          min="1"
          max="10"
          value={maxRetries}
          onChange={(e) => setMaxRetries(parseInt(e.target.value) || 3)}
          className="w-16 text-center"
          readOnly={false}
        />
      </Tooltip>
  </SettingsSection>
);

/**
 * Source management section
 */
export const SourceManagement: React.FC<{
  randomizeSource: boolean;
  setRandomizeSource: (value: boolean) => void;
  sourceUrl: string;
  setSourceUrl: (value: string) => void;
  autoUpdateEnabled: boolean;
  setAutoUpdateEnabled: (value: boolean) => void;
  updateInterval: number;
  setUpdateInterval: (value: number) => void;
}> = ({ 
  randomizeSource, 
  setRandomizeSource, 
  sourceUrl, 
  setSourceUrl, 
  autoUpdateEnabled, 
  setAutoUpdateEnabled, 
  updateInterval, 
  setUpdateInterval 
}) => (
  <SettingsSection title="Source" icon={Globe}>
      <Tooltip content="Load proxies from external source URL">
        <Button
          type="button"
          onClick={() => setRandomizeSource(!randomizeSource)}
          variant={randomizeSource ? 'default' : 'outline'}
          size="sm"
          className="w-full gap-1.5 h-7 text-xs justify-start"
        >
          <RotateCcw size={12} />
          Randomize
        </Button>
      </Tooltip>

      {randomizeSource && (
        <div className="space-y-1">
          <Tooltip content="URL to fetch proxy list from">
            <Input
              label="Source URL"
              floatingLabel
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </Tooltip>
        </div>
      )}

      <Tooltip content="Automatically update proxy list at regular intervals">
        <Button
          type="button"
          onClick={() => setAutoUpdateEnabled(!autoUpdateEnabled)}
          variant={autoUpdateEnabled ? 'default' : 'outline'}
          size="sm"
          className="w-full gap-1.5 h-7 text-xs justify-start"
        >
          <RefreshCw size={12} />
          Auto Update
        </Button>
      </Tooltip>

      {autoUpdateEnabled && (
        <Tooltip content="Update interval in minutes (1-1440)">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground flex-shrink-0">Interval:</label>
            <Input
              type="number"
              min="1"
              max="1440"
              value={updateInterval}
              onChange={(e) => setUpdateInterval(parseInt(e.target.value) || 30)}
              className="h-7 w-16 text-xs text-center"
              placeholder="30"
              readOnly={false}
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </Tooltip>
      )}
  </SettingsSection>
);

/**
 * List management section
 */
export const ListManagement: React.FC<{
  showImport: boolean;
  setShowImport: (value: boolean) => void;
  handleTestAllProxies: () => Promise<void>;
  handleExport: () => void;
  isLoading: boolean;
  proxiesCount: number;
}> = ({ showImport, setShowImport, handleTestAllProxies, handleExport, isLoading, proxiesCount }) => (
  <SettingsSection title="List Management" icon={Settings}>
      <Tooltip content="Import proxies from text or file">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowImport(!showImport)}
          className="w-full gap-1.5 h-7 text-xs justify-start"
        >
          <Upload size={12} />
          Import
        </Button>
      </Tooltip>

      <Tooltip content="Test connectivity of all proxies">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void handleTestAllProxies();
          }}
          disabled={isLoading || proxiesCount === 0}
          className="w-full gap-1.5 h-7 text-xs justify-start"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          Test All
        </Button>
      </Tooltip>

      <Tooltip content="Export proxy list to file">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={proxiesCount === 0}
          className="w-full gap-1.5 h-7 text-xs justify-start"
        >
          <Download size={12} />
          Export
        </Button>
      </Tooltip>
  </SettingsSection>
);
