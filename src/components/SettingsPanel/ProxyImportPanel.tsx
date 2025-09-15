/**
 * @file Proxy import panel component
 */
import React from 'react';

import { Button } from '../../shared/ui/button';
import { Card, CardContent } from '../../shared/ui/card';

interface ProxyImportPanelProps {
  showImport: boolean;
  importText: string;
  setImportText: (text: string) => void;
  setShowImport: (show: boolean) => void;
  handleImport: () => Promise<void>;
}

/**
 * Panel component for importing proxy lists
 */
export const ProxyImportPanel: React.FC<ProxyImportPanelProps> = ({
  showImport,
  importText,
  setImportText,
  setShowImport,
  handleImport
}) => {
  if (!showImport) {
    return null;
  }

  return (
    <Card className="mb-4 border-0 shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">Import Proxies</h4>
          <span className="text-xs text-muted-foreground">
            {importText.split('\n').filter(line => line.trim() && !line.startsWith('#')).length} proxies detected
          </span>
        </div>
        <textarea
          className="w-full min-h-[80px] px-3 py-2 text-sm rounded border border-input bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          placeholder="type:host:port:username:password (one per line)&#10;socks5:192.168.1.1:1080:user:pass&#10;http:proxy.example.com:8080::"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowImport(false)}>
            Cancel
          </Button>
          <Button 
            type="button" 
            size="sm" 
            onClick={() => {
              void handleImport();
            }} 
            disabled={!importText.trim()}
          >
            Import
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProxyImportPanel;
