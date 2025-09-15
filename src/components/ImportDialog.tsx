/**
 * @file Simple import dialog for account files with drag-and-drop
 */
import {
  Upload,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import React, { useState, useCallback } from 'react';

// ClipboardService is now accessed via IPC API
import { Button } from '../shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../shared/ui/dialog';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (_result: { addedCount: number; skippedCount: number }) => void;
}

type ImportState = 'idle' | 'complete' | 'error';

/**
 * Hook for import dialog logic
 */
const useImportDialog = (
  isOpen: boolean,
  onImportComplete: (_result: { addedCount: number; skippedCount: number }) => void
): {
  state: ImportState;
  setState: (_state: ImportState) => void;
  error: string;
  setError: (_error: string) => void;
  importResult: { addedCount: number; skippedCount: number } | null;
  isDragOver: boolean;
  setIsDragOver: (_value: boolean) => void;
  handleImport: () => Promise<void>;
  handleFileImport: (_file: File) => Promise<void>;
} => {
  const [state, setState] = useState<ImportState>('idle');
  const [error, setError] = useState<string>('');
  const [importResult, setImportResult] = useState<{ addedCount: number; skippedCount: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!isOpen) {
      setState('idle');
      setError('');
      setImportResult(null);
      setIsDragOver(false);
    }
  }, [isOpen]);

  const handleImport = useCallback(async (): Promise<void> => {
    setError('');

    try {
      // Open file dialog and import from selected file
      const result = await window.ipcApi.importFromFileInstant();

      if (result.error !== null && result.error !== undefined && result.error.length > 0) {
        setError(result.error);
        setState('error');
        return;
      }

      setImportResult({
        addedCount: result.addedCount,
        skippedCount: result.skippedCount,
      });
      setState('complete');
      onImportComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setState('error');
    }
  }, [onImportComplete]);

  const handleFileImport = useCallback(async (file: File): Promise<void> => {
    setError('');

    try {
      // Read file content and use importFromFileContent
      const content = await file.text();
      const result = await window.ipcApi.importFromFileContent(content);

      if (result.error !== null && result.error !== undefined && result.error.length > 0) {
        setError(result.error);
        setState('error');
        return;
      }

      setImportResult({
        addedCount: result.addedCount,
        skippedCount: result.skippedCount,
      });
      setState('complete');
      onImportComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setState('error');
    }
  }, [onImportComplete]);

  return {
    state,
    setState,
    error,
    setError,
    importResult,
    isDragOver,
    setIsDragOver,
    handleImport,
    handleFileImport,
  };
};

/**
 * Idle state component for import dialog
 */
const IdleState: React.FC<{
  isDragOver: boolean;
  onImport: () => void;
}> = ({ isDragOver, onImport }) => (
  <div
    className={`text-center py-8 border-2 border-dashed rounded-lg transition-colors ${
      isDragOver
        ? 'border-blue-500 bg-blue-500/10'
        : 'border-border hover:border-blue-500/50'
    }`}
  >
    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
    <h3 className="text-lg font-medium mb-2">Import Accounts</h3>
    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
      {isDragOver
        ? 'Drop the file here to import accounts'
        : 'Drag & drop a file here or click to select. Supported formats: email:password, email;password, email|password'
      }
    </p>
    {!isDragOver && (
      <Button onClick={onImport} className="gap-2">
        <Upload size={16} />
        Select File & Import
      </Button>
    )}
  </div>
);

/**
 * Complete state component for import dialog
 */
const CompleteState: React.FC<{
  importResult: { addedCount: number; skippedCount: number } | null;
  onClose: () => void;
}> = ({ importResult, onClose }) => (
  <div className="text-center py-8">
    <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
    <h3 className="text-lg font-medium mb-2">Import Complete</h3>
    {importResult && (
      <p className="text-muted-foreground mb-6">
        Successfully imported {importResult.addedCount} accounts.
        {importResult.skippedCount > 0 && ` ${importResult.skippedCount} lines were skipped.`}
      </p>
    )}
    <Button onClick={onClose}>Close</Button>
  </div>
);

/**
 * Error state component for import dialog
 */
const ErrorState: React.FC<{
  error: string;
  onClose: () => void;
}> = ({ error, onClose }) => (
  <div className="text-center py-8">
    <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
    <h3 className="text-lg font-medium mb-2">Import Failed</h3>
    <p className="text-muted-foreground mb-6">{error}</p>
    <Button onClick={onClose}>Close</Button>
  </div>
);

export const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const {
    state,
    setState,
    error,
    setError,
    importResult,
    isDragOver,
    setIsDragOver,
    handleImport,
    handleFileImport,
  } = useImportDialog(isOpen, onImportComplete);



  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, [setIsDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, [setIsDragOver]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const textFile = files.find(file =>
      file.type === 'text/plain' ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.csv')
    );

    if (textFile) {
      void handleFileImport(textFile);
    } else {
      setError('Please drop a text file (.txt or .csv)');
      setState('error');
    }
  }, [handleFileImport, setIsDragOver, setError, setState]);



  const renderIdleState = (): React.JSX.Element => (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <IdleState
        isDragOver={isDragOver}
        onImport={() => void handleImport()}
      />
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Account Import</DialogTitle>
          <DialogDescription>
            Import email accounts from text files with various formats (email:password, email;password, email|password).
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[300px]">
          {state === 'idle' && renderIdleState()}
          {state === 'complete' && (
            <CompleteState
              importResult={importResult}
              onClose={onClose}
            />
          )}
          {state === 'error' && (
            <ErrorState
              error={error}
              onClose={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
