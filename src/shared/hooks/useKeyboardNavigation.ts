/**
 * @file Custom hook for keyboard navigation support
 */
import { useEffect, useCallback } from 'react';

interface ListNavigationReturn {
  selectedIndex: number;
  handleArrowUp: () => void;
  handleArrowDown: () => void;
  handleEnter: () => void;
}

interface UseKeyboardNavigationOptions {
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onSpace?: () => void;
  onDelete?: () => void;
  enabled?: boolean;
}

/**
 * Custom hook that provides keyboard navigation functionality
 * Supports arrow keys, Enter, Escape, Space, and Delete
 */
export const useKeyboardNavigation = (options: UseKeyboardNavigationOptions): void => {
  const {
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onEnter,
    onEscape,
    onSpace,
    onDelete,
    enabled = true
  } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent): void => {
    if (!enabled) return;

    // Don't handle keyboard events when user is typing in an input
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        onArrowUp?.();
        break;
      case 'ArrowDown':
        event.preventDefault();
        onArrowDown?.();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        onArrowLeft?.();
        break;
      case 'ArrowRight':
        event.preventDefault();
        onArrowRight?.();
        break;
      case 'Enter':
        event.preventDefault();
        onEnter?.();
        break;
      case 'Escape':
        event.preventDefault();
        onEscape?.();
        break;
      case ' ':
        event.preventDefault();
        onSpace?.();
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        onDelete?.();
        break;
    }
  }, [enabled, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onEnter, onEscape, onSpace, onDelete]);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return (): void => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown, enabled]);
};

/**
 * Hook for managing focus within a list of items
 */
export const useListNavigation = <T>(
  items: T[],
  selectedIndex: number,
  onSelectionChange: (index: number) => void,
  onActivate?: (item: T, index: number) => void,
  enabled = true
): ListNavigationReturn => {
  const handleArrowUp = useCallback(() => {
    if (items.length === 0) return;
    const newIndex = selectedIndex > 0 ? selectedIndex - 1 : items.length - 1;
    onSelectionChange(newIndex);
  }, [items.length, selectedIndex, onSelectionChange]);

  const handleArrowDown = useCallback(() => {
    if (items.length === 0) return;
    const newIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
    onSelectionChange(newIndex);
  }, [items.length, selectedIndex, onSelectionChange]);

  const handleEnter = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      onActivate?.(items[selectedIndex], selectedIndex);
    }
  }, [items, selectedIndex, onActivate]);

  useKeyboardNavigation({
    onArrowUp: handleArrowUp,
    onArrowDown: handleArrowDown,
    onEnter: handleEnter,
    enabled
  });

  return {
    selectedIndex,
    handleArrowUp,
    handleArrowDown,
    handleEnter
  };
};
