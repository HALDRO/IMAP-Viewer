/**
 * @file Zustand store for managing a persistent log of application events.
 */
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import type { UILog } from '../../services/logger';

export type LogType = 'success' | 'error' | 'info' | 'warn';

export interface LogMessage extends UILog {
  id: string;
  timestamp: number;
}

export interface LogState {
  logs: LogMessage[];
  addLog: (log: UILog) => void;
  clearLogs: () => void;
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  addLog: (log: UILog): void => {
    // Prevent potential infinite loops by checking if we're already processing
    const currentLogs = get().logs;

    // Additional validation to prevent invalid logs
    if (!log || typeof log !== 'object' || !log.msg || typeof log.msg !== 'string') {
      return;
    }

    // Check for duplicate logs (same message and timestamp within 1 second)
    const isDuplicate = currentLogs.some(existingLog =>
      existingLog.msg === log.msg &&
      Math.abs(existingLog.timestamp - log.time) < 1000
    );

    if (isDuplicate) {
      return; // Skip duplicate log
    }

    const newLog: LogMessage = {
      ...log,
      id: uuidv4(),
      timestamp: log.time,
    };

    // Keep only the last 500 logs to prevent memory issues
    // Use functional update to avoid potential race conditions
    set((state) => {
      const updatedLogs = [...state.logs, newLog];
      return { logs: updatedLogs.slice(-500) };
    });
  },
  clearLogs: (): void => set({ logs: [] }),
}));