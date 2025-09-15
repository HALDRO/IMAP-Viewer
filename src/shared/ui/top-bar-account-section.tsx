/**
 * @file Account section component for the top bar
 */
import { Settings, ChevronLeft, ChevronRight, RefreshCw, Users, FolderOpen, Upload, Trash2, ChevronDown } from 'lucide-react';
import React from 'react';

import { cn } from '../utils/utils';

import { Button } from './button';

interface TopBarAccountSectionProps {
  accountCount: number;
  isCollapsed: boolean;
  isConnectingAll: boolean;
  isSettingsOpen?: boolean;
  onSettings: () => void;
  onToggleCollapse: () => void;
  onConnectAll: () => void;
  onDataFiles: () => void;
  onImportAccounts: () => void;
  onDeleteAllAccounts: () => void;
}

/**
 * Account section for the top bar showing account count and actions
 */
export const TopBarAccountSection: React.FC<TopBarAccountSectionProps> = React.memo(({
  accountCount,
  isCollapsed,
  isConnectingAll,
  isSettingsOpen = false,
  onSettings,
  onToggleCollapse,
  onConnectAll,
  onDataFiles,
  onImportAccounts,
  onDeleteAllAccounts
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  // Мемоизируем обработчики
  const handleToggleDropdown = React.useCallback(() => {
    setIsDropdownOpen(prev => !prev);
  }, []);

  const handleCloseDropdown = React.useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const handleImportClick = React.useCallback(() => {
    handleCloseDropdown();
    onImportAccounts();
  }, [handleCloseDropdown, onImportAccounts]);

  const handleConnectAllClick = React.useCallback(() => {
    handleCloseDropdown();
    onConnectAll();
  }, [handleCloseDropdown, onConnectAll]);

  const handleDeleteAllClick = React.useCallback(() => {
    handleCloseDropdown();
    onDeleteAllAccounts();
  }, [handleCloseDropdown, onDeleteAllAccounts]);

  const handleDataFilesClick = React.useCallback(() => {
    handleCloseDropdown();
    onDataFiles();
  }, [handleCloseDropdown, onDataFiles]);

  return (
    <div className="flex items-center gap-1">
      {/* Connect All + Account Status */}
      <div className="flex items-center gap-1 relative">
        {/* Account Management Button */}
        <Button
          variant="ghost"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground h-8 px-2"
          onClick={handleToggleDropdown}
        >
          <Users className="text-primary" style={{ width: '20px', height: '20px' }} />
          <span className="font-medium">{accountCount}</span>
          <span>{accountCount === 1 ? 'Account' : 'Accounts'}</span>
          <ChevronDown size={14} className="opacity-50" />
        </Button>
        
        {/* Simple dropdown menu */}
        {isDropdownOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={handleCloseDropdown}
            />
            
            {/* Menu */}
            <div className="absolute top-full right-0 z-50 min-w-[12rem] mt-1 bg-popover border rounded-md shadow-md p-1">
              <button
                onClick={handleImportClick}
                className="flex items-center w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import Accounts
              </button>
              
              <button
                onClick={handleConnectAllClick}
                disabled={isConnectingAll}
                className="flex items-center w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", isConnectingAll && "animate-spin")} />
                {isConnectingAll ? "Connecting..." : "Connect All Accounts"}
              </button>
              
              <div className="h-px bg-border my-1" />
              
              <button
                onClick={handleDeleteAllClick}
                className="flex items-center w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete All Accounts
              </button>
              
              <div className="h-px bg-border my-1" />
              
              <button
                onClick={handleDataFilesClick}
                className="flex items-center w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Open Data Folder
              </button>
            </div>
          </>
        )}
      </div>

      {/* Settings Button */}
      <Button
        variant={isSettingsOpen ? "default" : "ghost"}
        size="icon"
        onClick={onSettings}
        className="h-8 w-8 rounded-full"
        title="Settings"
      >
        <Settings size={16} />
      </Button>

      {/* Collapse/Expand Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        className="h-8 w-8 rounded-full"
        title={isCollapsed ? "Expand account panel" : "Collapse account panel"}
      >
        {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </Button>
    </div>
  );
});
