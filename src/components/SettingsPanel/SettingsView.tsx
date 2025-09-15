/**
 * @file Component for displaying settings directly in the main content area
 */
import { Globe, Shield, Users, RotateCcw, Settings } from 'lucide-react';
import React, { useState } from 'react';

import { useUIStore } from '../../shared/store/uiStore';
import { Button } from '../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Tooltip } from '../../shared/ui/tooltip';

import MainSettings from './MainSettings';
import ProxySettings from './ProxySettings';


type SettingsTab = 'main' | 'proxy' | 'security' | 'accounts';



const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('main');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const { resetConfig } = useUIStore();

  const handleResetConfig = (): void => {
    resetConfig();
    setShowResetDialog(false);
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-border bg-background/95 backdrop-blur h-12 px-4">
        <div />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('main')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'main'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Settings size={16} />
            Main
          </button>

          <button
            onClick={() => setActiveTab('proxy')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'proxy'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Globe size={16} />
            Proxy
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'security'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Shield size={16} />
            Security
          </button>

          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'accounts'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Users size={16} />
            Actions
          </button>
        </div>

        {/* Reset Config Button */}
        <Tooltip content="Reset all settings to default">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowResetDialog(true)}
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <RotateCcw size={16} />
          </Button>
        </Tooltip>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto custom-scrollbar bg-background">
        <div className="p-4">
          {activeTab === 'main' && (
            <MainSettings />
          )}

          {activeTab === 'proxy' && (
            <ProxySettings />
          )}

          {activeTab === 'security' && (
            <div className="max-w-2xl mx-auto">
              <Card className="border-0 shadow-none">
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Security settings will be added in a future update.</p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="max-w-2xl mx-auto">
              <Card className="border-0 shadow-none">
                <CardHeader>
                  <CardTitle>Account Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Batch account operations will be added in a future update.</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        </main>

        {/* Reset Configuration Confirmation Dialog */}
        {showResetDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="text-lg">Reset Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Are you sure you want to reset all settings to default? This will reset panel sizes, positions, and all UI preferences. This action cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowResetDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleResetConfig}
                  >
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  );
};

export default SettingsView; 