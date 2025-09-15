/**
 * @file Context menu for accessing data files
 */
import { FolderOpen, FileText } from 'lucide-react';
import React from 'react';

import { Button } from '../shared/ui/button';

interface DataFilesMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

/**
 * Context menu component for data files access
 */
export const DataFilesMenu: React.FC<DataFilesMenuProps> = ({
  isOpen,
  onClose,
  anchorRef
}) => {
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        x: rect.left,
        y: rect.bottom + 4
      });
    }
  }, [isOpen, anchorRef]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && anchorRef.current && !anchorRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, anchorRef]);

  const handleOpenDataFolder = React.useCallback(async () => {
    try {
      await window.ipcApi.openDataFolder();
    } catch (error) {
      console.error('Failed to open data folder:', error);
    }
    onClose();
  }, [onClose]);

  const handleOpenAccountsFile = React.useCallback(async () => {
    try {
      await window.ipcApi.openAccountsFile();
    } catch (error) {
      console.error('Failed to open accounts file:', error);
    }
    onClose();
  }, [onClose]);

  const handleOpenConfigFile = React.useCallback(async () => {
    try {
      await window.ipcApi.openConfigFile();
    } catch (error) {
      console.error('Failed to open config file:', error);
    }
    onClose();
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-48"
      style={{
        left: position.x,
        top: position.y
      }}
    >
      <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
        Data Files
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpenDataFolder}
        className="w-full justify-start px-3 py-2 h-auto text-sm"
      >
        <FolderOpen size={16} className="mr-2" />
        Open Data Folder
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpenAccountsFile}
        className="w-full justify-start px-3 py-2 h-auto text-sm"
      >
        <FileText size={16} className="mr-2" />
        Accounts File
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpenConfigFile}
        className="w-full justify-start px-3 py-2 h-auto text-sm"
      >
        <FileText size={16} className="mr-2" />
        Config File
      </Button>
    </div>
  );
};
