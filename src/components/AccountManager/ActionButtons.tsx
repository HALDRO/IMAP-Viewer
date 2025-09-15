/**
 * @file Action buttons component for account management
 */
import { PlusCircle, Upload } from 'lucide-react';
import React from 'react';

import { Button } from '../../shared/ui/button';

interface ActionButtonsProps {
  onAddNew: () => void | Promise<void>;
  onImport: () => void | Promise<void>;
  isDragOver: boolean;
  collapsed?: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onAddNew,
  onImport,
  isDragOver,
  collapsed = false,
}) => {
  if (collapsed) {
    return (
      <div className="border-t border-gray-800/50 pt-2 w-full">
        <div className="flex flex-col items-center gap-2 px-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { void onAddNew(); }}
            title="Add account"
            aria-label="Add new account"
            className="rounded-full w-8 h-8"
          >
            <PlusCircle size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { void onImport(); }}
            title={isDragOver ? "Drop file to import" : "Import account list"}
            aria-label="Import account list"
            className={`rounded-full w-8 h-8 transition-colors ${
              isDragOver ? 'bg-primary/20 text-primary' : ''
            }`}
          >
            <Upload size={16} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border p-2">
      <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
        <Button
          onClick={() => { void onAddNew(); }}
          className="flex-1 h-8 gap-1 rounded-md min-w-0"
          variant="secondary"
          size="sm"
          title="Add new account"
        >
          <PlusCircle size={14} className="flex-shrink-0" />
          <span className="truncate text-xs">Add</span>
        </Button>
        <Button
          onClick={() => { void onImport(); }}
          className={`flex-1 h-8 gap-1 rounded-md min-w-0 transition-colors ${
            isDragOver ? 'bg-primary/20 text-primary' : ''
          }`}
          variant="ghost"
          size="sm"
          title={isDragOver ? "Drop file to import" : "Import account list"}
        >
          <Upload size={14} className="flex-shrink-0" />
          <span className="truncate text-xs">Import</span>
        </Button>
      </div>
    </div>
  );
};
