/**
 * @file Loading spinner component with accessibility features using ShadCN UI
 */
import { Loader2 } from 'lucide-react';
import React from 'react';

import { Skeleton } from '../shared/ui';
import { Card, CardContent } from '../shared/ui/card';
import { cn } from '../shared/utils/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'muted' | 'primary';
  text?: string;
  className?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
};

const variantClasses = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  primary: 'text-primary'
};

/**
 * Accessible loading spinner component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  text,
  className = '',
  fullScreen = false
}) => {
  const spinner = (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      <Loader2
        className={cn(
          sizeClasses[size],
          variantClasses[variant],
          "animate-spin"
        )}
        aria-hidden="true"
      />
      {(text?.length ?? 0) > 0 && (
        <span className={cn("text-sm", variantClasses[variant])}>
          {text}
        </span>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
        role="status"
        aria-label="Loading"
      >
        <Card className="p-6">
          <CardContent className="p-0">
            {spinner}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div role="status" aria-label="Loading">
      {spinner}
    </div>
  );
};

/**
 * Loading overlay for specific components
 */
export const LoadingOverlay: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  text?: string;
  className?: string;
}> = ({ isLoading, children, text = 'Loading...', className = '' }) => {
  return (
    <div className={cn("relative", className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10">
          <LoadingSpinner text={text} variant="primary" />
        </div>
      )}
    </div>
  );
};

/**
 * Skeleton loader for content placeholders
 */
export const SkeletonLoader: React.FC<{
  lines?: number;
  className?: string;
  showAvatar?: boolean;
  showButton?: boolean;
}> = ({ lines = 3, className = '', showAvatar = false, showButton = false }) => {
  return (
    <div className={cn("space-y-3", className)} aria-label="Loading content">
      {showAvatar && (
        <div className="flex items-center space-x-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      )}

      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={`skeleton-${Date.now()}-${lines}-${index}`}
          className={cn(
            "h-4",
            index === lines - 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}

      {showButton && (
        <Skeleton className="h-9 w-24 mt-4" />
      )}
    </div>
  );
};

export default LoadingSpinner;
