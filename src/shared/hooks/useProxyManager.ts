/**
 * @file Hook for managing proxy operations and state
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useProxyListStore } from '../store/proxyListStore';
import { useProxyStore } from '../store/proxyStore';
import type { GlobalProxyConfig } from '../types/account';
import { logger as appLogger } from '../utils/logger';

// Proxy form validation schema
const proxyFormSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1, 'Port must be greater than 0').max(65535, 'Port must be less than 65536'),
  username: z.string().optional(),
  password: z.string().optional(),
  type: z.enum(['http', 'https', 'socks4', 'socks5']).optional(),
});

export type ProxyFormData = z.infer<typeof proxyFormSchema>;

interface UseProxyManagerReturn {
  // Form state
  form: ReturnType<typeof useForm<ProxyFormData>>;
  isEditing: boolean;
  editingIndex: number | null;

  // UI state
  isPasswordVisible: boolean;
  setIsPasswordVisible: (_visible: boolean) => void;

  // Actions
  handleAddProxy: (_data: ProxyFormData & { type?: 'http' | 'https' | 'socks4' | 'socks5' }) => void;
  handleEditProxy: (_index: number) => void;
  handleUpdateProxy: (_data: ProxyFormData) => void;
  handleDeleteProxy: (_index: number) => void;
  handleCancelEdit: () => void;
  handleTestProxy: (_index: number) => Promise<void>;
  handleTestAllProxies: () => Promise<void>;
  handleImportProxies: (_text: string) => Promise<void>;
  handleExportProxies: () => string;

  // Proxy settings
  enableProxies: boolean;
  setEnableProxies: (_enabled: boolean) => Promise<void>;

  // Source randomization
  randomizeSource: boolean;
  setRandomizeSource: (_enabled: boolean) => void;
  sourceUrl: string;
  setSourceUrl: (_url: string) => void;

  // Auto update
  autoUpdateEnabled: boolean;
  setAutoUpdateEnabled: (_enabled: boolean) => void;
  updateInterval: number;
  setUpdateInterval: (_interval: number) => void;

  // Retry settings
  maxRetries: number;
  setMaxRetries: (retries: number) => void;

  // Random proxy selection
  useRandomProxy: boolean;
  setUseRandomProxy: (enabled: boolean) => void;

  // Loading states
  isLoading: boolean;
  isTesting: Record<number, boolean>;

  // State from store
  proxies: Array<{ host: string; port: number; username?: string; password?: string; type?: 'http' | 'https' | 'socks4' | 'socks5' }>;
  currentProxyIndex: number;
  testResults: Record<number, { success: boolean; error?: string; timestamp: number }>;
}

/**
 * Hook for managing proxy functionality
 */
/* eslint-disable @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/require-await */
export const useProxyManager = (): UseProxyManagerReturn => {
  const {
    proxies,
    currentProxyIndex,
    testResults,
    addProxy,
    updateProxy,
    deleteProxy,
    testProxy,
    loadProxies,
    removeDuplicates,
    isLoading: storeLoading,
  } = useProxyListStore();

  const { config, setConfig } = useProxyStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isTesting, setIsTesting] = useState<Record<number, boolean>>({});

  // Derive enableProxies from global proxy store
  const enableProxies = config?.enabled ?? false;

  // Source randomization
  const [randomizeSource, setRandomizeSource] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');

  // Auto update
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [updateInterval, setUpdateInterval] = useState(30);

  // Retry settings
  const [maxRetries, setMaxRetries] = useState(3);

  // Random proxy selection
  const [useRandomProxy, setUseRandomProxy] = useState(false);

  const form = useForm<ProxyFormData>({
    resolver: zodResolver(proxyFormSchema),
    defaultValues: {
      host: '127.0.0.1',
      port: 10808,
      username: '',
      password: '',
    },
  });

  const { reset } = form;

  // Load proxies on mount
  useEffect(() => {
    void loadProxies();
  }, [loadProxies]);

  // Function to enable/disable proxies globally
  const setEnableProxies = useCallback(async (enabled: boolean) => {
    try {
      // Check if IPC API is available
      if (window.ipcApi?.proxy?.setGlobal === null || window.ipcApi?.proxy?.setGlobal === undefined) {
        appLogger.error('IPC API not available');
        return;
      }

      if (enabled) {
        if (proxies.length === 0) {
          appLogger.error('Cannot enable proxy: No proxies configured');
          return;
        }

        // Enable proxy with the first available proxy
        const firstProxy = proxies[0];
        appLogger.info(`Attempting to enable proxy: ${firstProxy.host}:${firstProxy.port}`);

        const proxyConfig: GlobalProxyConfig = {
          enabled: true,
          type: (firstProxy.type ?? 'socks5'),
          hostPort: `${firstProxy.host}:${firstProxy.port}`,
          auth: !!(firstProxy.username !== null && firstProxy.username !== undefined && firstProxy.username.length > 0 &&
                   firstProxy.password !== null && firstProxy.password !== undefined && firstProxy.password.length > 0),
          username: firstProxy.username,
          password: firstProxy.password,
        };

        // Update local state immediately to prevent UI flicker
        setConfig(proxyConfig);
        window.ipcApi.proxy.setGlobal(proxyConfig);
        appLogger.info(`Proxy enabled successfully: ${firstProxy.host}:${firstProxy.port}`);
      } else {
        // Disable proxy
        appLogger.info('Disabling proxy...');
        // Update local state immediately
        setConfig(null);
        window.ipcApi.proxy.setGlobal(null);
        appLogger.info('Proxy disabled successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      appLogger.error(`Proxy operation failed: ${errorMessage}`);
      // eslint-disable-next-line no-console
      console.error('Proxy operation error:', error);
      // Don't re-throw the error to prevent component crashes
    }
  }, [proxies, setConfig]);

  const handleAddProxy = useCallback((data: ProxyFormData & { type?: 'http' | 'https' | 'socks4' | 'socks5' }) => {
    // Check for duplicates before adding
    const isDuplicate = proxies.some(proxy =>
      proxy.host.toLowerCase().trim() === data.host.toLowerCase().trim() &&
      proxy.port === data.port &&
      (proxy.username ?? '').toLowerCase().trim() === (data.username ?? '').toLowerCase().trim()
    );

    if (isDuplicate) {
      appLogger.error(`Proxy ${data.host}:${data.port} already exists`);
      return;
    }

    // Add the proxy
    addProxy(data);
    appLogger.info(`Proxy ${data.host}:${data.port} added`);

    // Immediately remove duplicates synchronously
    const removedCount = removeDuplicates();
    if (removedCount > 0) {
      appLogger.info(`Removed ${removedCount} duplicate proxy(ies)`);
    }

    // Reset form
    reset({
      host: '127.0.0.1',
      port: 10808,
      username: '',
      password: '',
    });
  }, [addProxy, reset, proxies, removeDuplicates]);

  const handleEditProxy = useCallback((index: number) => {
    const proxy = proxies[index];
    if (proxy) {
      setIsEditing(true);
      setEditingIndex(index);
      reset({
        host: proxy.host,
        port: proxy.port,
        username: proxy.username || '',
        password: proxy.password || '',
      });
    }
  }, [proxies, reset]);

  const handleUpdateProxy = useCallback((data: ProxyFormData) => {
    if (editingIndex !== null) {
      updateProxy(editingIndex, data);
      appLogger.info(`Proxy ${data.host}:${data.port} updated`);
      setIsEditing(false);
      setEditingIndex(null);
      reset();
    }
  }, [editingIndex, updateProxy, reset]);

  const handleDeleteProxy = useCallback((index: number) => {
    const proxy = proxies[index];
    if (proxy) {
      deleteProxy(index);
      appLogger.info(`Proxy ${proxy.host}:${proxy.port} deleted`);
      
      // If we were editing this proxy, cancel the edit
      if (editingIndex === index) {
        setIsEditing(false);
        setEditingIndex(null);
        reset();
      }
    }
  }, [proxies, deleteProxy, editingIndex, reset]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingIndex(null);
    reset();
  }, [reset]);

  const handleTestProxy = useCallback(async (index: number) => {
    const proxy = proxies[index];
    if (proxy) {
      setIsTesting(prev => ({ ...prev, [index]: true }));
      appLogger.info(`Testing proxy ${proxy.host}:${proxy.port}...`);
      try {
        await testProxy(index);
        const result = testResults[index];
        if (result?.success) {
          appLogger.info(`Proxy ${proxy.host}:${proxy.port} test successful`);
        } else {
          appLogger.error(`Proxy ${proxy.host}:${proxy.port} test failed: ${result?.error || 'Unknown error'}`);
        }
      } catch (error) {
        appLogger.error(`Proxy ${proxy.host}:${proxy.port} test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsTesting(prev => ({ ...prev, [index]: false }));
      }
    }
  }, [proxies, testProxy, testResults]);

  const handleTestAllProxies = useCallback(async () => {
    if (proxies.length === 0) {
      appLogger.info('No proxies to test');
      return;
    }

    appLogger.info(`Testing ${proxies.length} proxies...`);
    
    const testPromises = proxies.map((_, index) => handleTestProxy(index));
    await Promise.allSettled(testPromises);
    
    appLogger.info('Finished testing all proxies');
  }, [proxies, handleTestProxy]);

  const handleImportProxies = useCallback(async (text: string) => {
    try {
      const lines = text.split('\n').filter(line => line.trim());
      let imported = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Support formats: host:port, host:port:username:password, type://host:port
        let host: string;
        let port: number;
        let username: string | undefined;
        let password: string | undefined;


        if (trimmed.includes('://')) {
          // Format: type://host:port or type://username:password@host:port
          const [, rest] = trimmed.split('://');

          if (rest.includes('@')) {
            const [auth, hostPort] = rest.split('@');
            [username, password] = auth.split(':');
            [host, port] = hostPort.split(':').map((v, i) => i === 1 ? parseInt(v) : v) as [string, number];
          } else {
            [host, port] = rest.split(':').map((v, i) => i === 1 ? parseInt(v) : v) as [string, number];
          }
        } else {
          // Format: host:port or host:port:username:password
          const parts = trimmed.split(':');
          if (parts.length >= 2) {
            host = parts[0];
            port = parseInt(parts[1]);
            if (parts.length >= 4) {
              username = parts[2];
              password = parts[3];
            }
          } else {
            continue;
          }
        }

        if (host && !isNaN(port)) {
          addProxy({ host, port, username, password });
          imported++;
        }
      }

      appLogger.info(`Imported ${imported} proxies successfully`);
    } catch (error) {
      appLogger.error(`Failed to import proxies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [addProxy]);

  const handleExportProxies = useCallback(() => {
    const lines = proxies.map(proxy => {
      const auth = proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : '';
      return `socks5://${auth}${proxy.host}:${proxy.port}`;
    });
    return lines.join('\n');
  }, [proxies]);

  return {
    form,
    isEditing,
    editingIndex,
    isPasswordVisible,
    setIsPasswordVisible,
    handleAddProxy,
    handleEditProxy,
    handleUpdateProxy,
    handleDeleteProxy,
    handleCancelEdit,
    handleTestProxy,
    handleTestAllProxies,
    handleImportProxies,
    handleExportProxies,
    enableProxies,
    setEnableProxies,
    randomizeSource,
    setRandomizeSource,
    sourceUrl,
    setSourceUrl,
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    updateInterval,
    setUpdateInterval,
    maxRetries,
    setMaxRetries,
    useRandomProxy,
    setUseRandomProxy,
    isLoading: storeLoading,
    isTesting,
    proxies,
    currentProxyIndex,
    testResults,
  };
};
