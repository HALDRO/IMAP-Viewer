/**
 * @file Unified top bar component for consistent application header
 */
import React from 'react';

import { cn } from '../utils/utils';

interface TopBarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Main top bar container that spans the full width of the application
 */
export const TopBar: React.FC<TopBarProps> = ({ children, className }) => {
  return (
    <header
      className={cn(
        // Layout - using CSS Grid for better performance
        "grid grid-cols-[auto_1fr_auto] items-center",
        "w-full h-14 px-4 gap-4",
        "border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "sticky top-0 z-50",

        // Custom classes
        className
      )}
    >
      {children}
    </header>
  );
};

interface TopBarSectionProps {
  children: React.ReactNode;
  className?: string;
  side?: 'left' | 'center' | 'right';
}

/**
 * Section container for organizing top bar content
 * Uses CSS Grid for optimal performance
 */
export const TopBarSection: React.FC<TopBarSectionProps> = ({ children, className, side }) => {
  const sideStyles = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end"
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        side && sideStyles[side],
        className
      )}
    >
      {children}
    </div>
  );
};

interface TopBarTitleProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Title component for the top bar
 */
export const TopBarTitle: React.FC<TopBarTitleProps> = ({ children, className, size = 'lg' }) => {
  const sizeStyles = {
    sm: "text-sm font-medium",
    md: "text-base font-semibold",
    lg: "text-lg font-semibold"
  };

  return (
    <h1 className={cn(sizeStyles[size], "text-foreground", className)}>
      {children}
    </h1>
  );
};

interface TopBarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Search input component for the top bar
 */
export const TopBarSearch: React.FC<TopBarSearchProps> = ({ 
  value, 
  onChange, 
  placeholder = "Search...", 
  className 
}) => {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  );
};
