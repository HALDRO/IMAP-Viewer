/**
 * @file Custom scrollbar component with modern design
 */
import React, { forwardRef } from 'react';
import { cn } from '../utils/utils';

interface CustomScrollbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Custom scrollbar component with unified modern styling
 * Uses the thin scrollbar style consistently across all components
 */
export const CustomScrollbar = forwardRef<HTMLDivElement, CustomScrollbarProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'custom-scrollbar',
          className
        )}
        style={{
          overflow: 'auto',
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CustomScrollbar.displayName = 'CustomScrollbar';

export default CustomScrollbar;
