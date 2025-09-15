/**
 * @file Proxy list component
 */
import { Globe, RefreshCw, Trash2 } from 'lucide-react';
import React from 'react';

import { Badge } from '../../shared/ui/badge';
import { Button } from '../../shared/ui/button';
import { Card, CardContent } from '../../shared/ui/card';

interface ProxyItem {
  host: string;
  port: number;
  username?: string;
  password?: string;
  type?: 'http' | 'https' | 'socks4' | 'socks5';
}

interface TestResult {
  success: boolean;
  error?: string;
  timestamp: number;
}

interface ProxyListProps {
  proxies: ProxyItem[];
  testResults: Record<number, TestResult>;
  isTesting: Record<number, boolean>;
  handleTestProxy: (index: number) => Promise<void>;
  handleDeleteProxy: (index: number) => void;
}

/**
 * Component for displaying and managing the proxy list
 */
export const ProxyList: React.FC<ProxyListProps> = ({
  proxies,
  testResults,
  isTesting,
  handleTestProxy,
  handleDeleteProxy
}) => {
  if (proxies.length === 0) {
    return (
      <Card className="flex-1 min-h-0 border-0 shadow-none">
        <CardContent className="p-0 h-full">
          <div className="text-center text-muted-foreground py-12">
            <Globe className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-medium mb-2">No proxies configured</p>
            <p className="text-sm">Add a proxy above or import a list to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex-1 min-h-0 border-0 shadow-none">
      <CardContent className="p-0 h-full">
        <div className="h-full overflow-hidden">
          <div className="p-3 border-b border-border bg-muted/20">
            <div className="text-xs font-medium text-muted-foreground">
              Proxy List ({proxies.length})
            </div>
          </div>
          <div className="overflow-y-auto h-full p-3 space-y-2">
            {proxies.map((proxy, index) => (
              <div
                key={`proxy-${proxy.host}-${proxy.port}`}
                className="flex items-center gap-3 p-2 border border-border rounded-md hover:bg-muted/30 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{proxy.host}:{proxy.port}</span>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-5">
                      {proxy.type?.toUpperCase() ?? 'SOCKS5'}
                    </Badge>
                    {(proxy.username?.length ?? 0) > 0 && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5">
                        Auth
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {testResults[index]?.success && (
                      <Badge variant="default" className="text-xs px-1.5 py-0.5 h-5 bg-green-500 hover:bg-green-600">
                        ✓ Working
                      </Badge>
                    )}
                    {testResults[index]?.success === false && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0.5 h-5">
                        ✗ Failed
                      </Badge>
                    )}
                    {testResults[index]?.timestamp && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(testResults[index].timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void handleTestProxy(index);
                    }}
                    disabled={isTesting[index]}
                    className="h-7 w-7 p-0"
                    title="Test proxy"
                  >
                    <RefreshCw size={12} className={isTesting[index] ? 'animate-spin' : ''} />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteProxy(index)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Delete proxy"
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProxyList;
