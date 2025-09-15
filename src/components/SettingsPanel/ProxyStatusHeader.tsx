/**
 * @file Proxy status header component
 */
import { Globe } from 'lucide-react';
import React from 'react';

import { Button } from '../../shared/ui/button';
import { cn } from '../../shared/utils/utils';

interface ProxyStatusHeaderProps {
  enableProxies: boolean;
  setEnableProxies: (_enabled: boolean) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  proxiesCount: number;
}

/**
 * Header component showing proxy status and controls
 */
export const ProxyStatusHeader: React.FC<ProxyStatusHeaderProps> = ({
  enableProxies,
  setEnableProxies,
  isLoading,
  error,
  proxiesCount
}) => {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mb-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", enableProxies ? 'bg-green-500' : 'bg-gray-500')} />
          <Button
            type="button"
            onClick={() => {
              void (async (): Promise<void> => {
                try {
                  await setEnableProxies(!enableProxies);
                } catch (toggleError) {
                  // Log error for debugging - consider using proper logging service in production
                  // TODO: Replace with proper logging service in production
                  // eslint-disable-next-line no-console
                  console.error('Failed to toggle proxy:', toggleError);
                }
              })();
            }}
            variant={enableProxies ? 'default' : 'outline'}
            size="sm"
            className="gap-2 h-8 px-4"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : (enableProxies ? 'Enabled' : 'Disabled')}
          </Button>
          {(error?.length ?? 0) > 0 && <span className="text-xs text-red-500 ml-1">({error})</span>}
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe size={14} />
          <span>{proxiesCount} {proxiesCount === 1 ? 'proxy' : 'proxies'}</span>
        </div>
      </div>
    </div>
  );
};

export default ProxyStatusHeader;
