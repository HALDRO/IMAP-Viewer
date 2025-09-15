/**
 * @file Zustand store for managing global proxy state.
 */
import { create } from 'zustand';

import type { GlobalProxyConfig } from '../types/account';
import type { ProxyStatus } from '../types/electron';

interface ProxyState {
  config: GlobalProxyConfig | null;
  status: ProxyStatus;
  error: string | null;
  externalIp: string | null;
  setConfig: (config: GlobalProxyConfig | null) => void;
  setStatus: (status: ProxyStatus, details?: { ip?: string; error?: string }) => void;
  initializeProxy: () => Promise<void>;
}

export const useProxyStore = create<ProxyState>((set, get) => ({
  config: null,
  status: 'disabled',
  error: null,
  externalIp: null,
  
  /**
   * Updates the global proxy configuration.
   */
  setConfig: (config: GlobalProxyConfig | null): void => {
    set({ config });
  },

  setStatus: (status: ProxyStatus, details: { error?: string; ip?: string } = {}): void => {
    const newState: Partial<ProxyState> = {
      status,
      error: details.error ?? null,
    };
    if (status === 'connected') {
      newState.externalIp = details.ip ?? null;
    } else if (status === 'disabled' || status === 'error') {
      newState.externalIp = null;
    }
    set(newState);
  },

  setExternalIp: (ip: string | null): void => set({ externalIp: ip }),
  setError: (error: string | null): void => set({ error }),
  
  /**
   * Fetches the initial proxy configuration from the main process.
   */
  initializeProxy: async (): Promise<void> => {
    try {
      const config = await window.ipcApi.proxy.getGlobal();
      get().setConfig(config);

      // Set up listener for proxy status updates
      window.ipcApi.proxy.onStatusUpdate((_event, status) => {
        get().setStatus(status.status, {
          ip: status.ip,
          error: status.error
        });
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize proxy settings:', e);
      get().setStatus('error', { error: e instanceof Error ? e.message : 'Initialization failed' });
    }
  },
})); 