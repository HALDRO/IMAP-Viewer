import { useState, useEffect, useRef } from 'react';

interface RelativeTimeOptions {
  updateInterval?: number; // in milliseconds, default 1000 (1 second)
  maxRelativeTime?: number; // in milliseconds, after this show absolute time
}

const formatRelativeTime = (date: Date, now: Date): string => {
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 10) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${diffYears}y ago`;
};

const formatAbsoluteTime = (date: Date): string => {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};

export const useRelativeTime = (
  dateString: string,
  options: RelativeTimeOptions = {}
): { relativeTime: string; absoluteTime: string; showRelative: boolean } => {
  const { updateInterval = 1000, maxRelativeTime = 24 * 60 * 60 * 1000 } = options; // 24 hours default
  
  const [now, setNow] = useState(() => new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const showRelative = diffMs <= maxRelativeTime;
  
  const relativeTime = formatRelativeTime(date, now);
  const absoluteTime = formatAbsoluteTime(date);
  
  useEffect(() => {
    if (showRelative) {
      intervalRef.current = setInterval(() => {
        setNow(new Date());
      }, updateInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [showRelative, updateInterval]);
  
  return {
    relativeTime,
    absoluteTime,
    showRelative
  };
};

// Hook for multiple dates (optimized for email lists)
export const useRelativeTimeList = (
  dates: string[],
  options: RelativeTimeOptions = {}
): Array<{ relativeTime: string; absoluteTime: string; showRelative: boolean }> => {
  const { updateInterval = 1000, maxRelativeTime = 24 * 60 * 60 * 1000 } = options;
  
  const [now, setNow] = useState(() => new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Check if any date needs relative time updates
  const hasRelativeDates = dates.some(dateString => {
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    return diffMs <= maxRelativeTime;
  });
  
  useEffect(() => {
    if (hasRelativeDates) {
      intervalRef.current = setInterval(() => {
        setNow(new Date());
      }, updateInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [hasRelativeDates, updateInterval]);
  
  return dates.map(dateString => {
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const showRelative = diffMs <= maxRelativeTime;
    
    return {
      relativeTime: formatRelativeTime(date, now),
      absoluteTime: formatAbsoluteTime(date),
      showRelative
    };
  });
};
