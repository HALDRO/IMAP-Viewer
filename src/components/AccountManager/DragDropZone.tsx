/**
 * @file Drag and drop zone component for importing account files
 */
import React from 'react';

interface DragDropZoneProps {
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  children: React.ReactNode;
  className?: string;
}

export const DragDropZone: React.FC<DragDropZoneProps> = ({
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
  className = '',
}) => {
  return (
    <div
      className={`${className} ${
        isDragOver ? 'bg-[#1a1a1a] border-r-2 border-primary' : ''
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
};

// Hook for drag and drop functionality
export const useDragDrop = (onImportComplete: (result: any) => void) => {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent): void => {
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
      void (async (): Promise<void> => {
        try {
          // Read file content using FileReader
          const fileContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e): void => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(textFile);
          });

          // Create a temporary file and import
          const result = await window.ipcApi.importFromFileContent(fileContent);
          if (typeof result.error === 'undefined' || result.error === null) {
            onImportComplete(result);
          }
        } catch {
          // Handle error silently or use proper error reporting
        }
      })();
    }
  }, [onImportComplete]);

  return {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};
