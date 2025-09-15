/**
 * @file Focused Zustand store for connection status management
 */
import { create } from 'zustand';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface ConnectionState {
  connectionStatuses: Record<string, ConnectionStatus>;
  
  // Connection status operations
  setConnectionStatus: (accountId: string, status: ConnectionStatus) => void;
  clearConnectionStatus: (accountId: string) => void;
  clearAllConnectionStatuses: () => void;
  
  // Getters
  getConnectionStatus: (accountId: string) => ConnectionStatus;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connectionStatuses: {},
  
  setConnectionStatus: (accountId: string, status: ConnectionStatus): void => set((state) => ({
    connectionStatuses: {
      ...state.connectionStatuses,
      [accountId]: status,
    },
  })),
  
  clearConnectionStatus: (accountId: string): void => set((state) => {
    const { [accountId]: _, ...rest } = state.connectionStatuses;
    return { connectionStatuses: rest };
  }),
  
  clearAllConnectionStatuses: (): void => set({
    connectionStatuses: {},
  }),
  
  getConnectionStatus: (accountId: string): ConnectionStatus => {
    return get().connectionStatuses[accountId] ?? 'disconnected';
  },
}));
