/**
 * @file Zustand store for managing proxy list state.
 */
import { create } from 'zustand';

interface ProxyItem {
  host: string;
  port: number;
  username?: string;
  password?: string;
  type?: 'http' | 'https' | 'socks4' | 'socks5';
}

interface TestResult {
  success: boolean;
  error?: string;
  responseTime?: number;
  loading?: boolean;
  timestamp: number;
}

interface ProxyListState {
  proxies: ProxyItem[];
  currentProxyIndex: number;
  testResults: Record<number, TestResult>;
  isLoading: boolean;

  // Actions
  setProxies: (proxies: ProxyItem[]) => void;
  addProxy: (proxy: ProxyItem) => void;
  updateProxy: (index: number, proxy: ProxyItem) => void;
  deleteProxy: (index: number) => void;
  setCurrentProxyIndex: (index: number) => void;
  setTestResult: (index: number, result: TestResult) => void;
  setLoading: (loading: boolean) => void;
  removeDuplicates: () => number;

  // Async actions
  loadProxies: () => Promise<void>;
  saveProxies: () => Promise<void>;
  testProxy: (index: number) => Promise<void>;
}

// Helper functions to reduce main function complexity
const createProxyActions = (
  set: (partial: Partial<ProxyListState> | ((_state: ProxyListState) => Partial<ProxyListState>)) => void,
  get: () => ProxyListState
): {
  setProxies: (_proxies: ProxyItem[]) => void;
  addProxy: (_proxy: ProxyItem) => void;
  updateProxy: (_index: number, _proxy: ProxyItem) => void;
  deleteProxy: (_index: number) => void;
  setCurrentProxyIndex: (_index: number) => void;
  setTestResult: (_index: number, _result: TestResult) => void;
  setLoading: (_loading: boolean) => void;
} => ({
  setProxies: (proxies: ProxyItem[]): void => set({ proxies }),

  addProxy: (proxy: ProxyItem): void => {
    const state = get();
    const newProxies = [...state.proxies, proxy];
    set({ proxies: newProxies });
    void get().saveProxies();
  },

  updateProxy: (index: number, proxy: ProxyItem): void => {
    const state = get();
    const newProxies = [...state.proxies];
    newProxies[index] = proxy;
    set({ proxies: newProxies });
    void get().saveProxies();
  },

  deleteProxy: (index: number): void => {
    const state = get();
    const newProxies = state.proxies.filter((_: ProxyItem, i: number) => i !== index);
    set({
      proxies: newProxies,
      currentProxyIndex: state.currentProxyIndex >= newProxies.length ? 0 : state.currentProxyIndex
    });
    void get().saveProxies();
  },

  setCurrentProxyIndex: (index: number): void => set({ currentProxyIndex: index }),
  setTestResult: (index: number, result: TestResult): void => set((state: ProxyListState) => ({
    testResults: { ...state.testResults, [index]: result }
  })),
  setLoading: (loading: boolean): void => set({ isLoading: loading }),
});

// Utility functions for proxy operations
const createRemoveDuplicates = (
  set: (_partial: Partial<ProxyListState>) => void,
  get: () => ProxyListState
) => (): number => {
  const state = get();
  const uniqueProxies: ProxyItem[] = [];
  const seen = new Set<string>();

  for (const proxy of state.proxies) {
    const key = `${proxy.host.toLowerCase().trim()}:${proxy.port}:${(proxy.username ?? '').toLowerCase().trim()}:${proxy.type ?? 'socks5'}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueProxies.push(proxy);
    }
  }

  const removedCount = state.proxies.length - uniqueProxies.length;
  if (removedCount > 0) {
    set({ proxies: uniqueProxies });
    void get().saveProxies();
  }
  return removedCount;
};

const createLoadProxies = (
  set: (_partial: Partial<ProxyListState>) => void
) => async (): Promise<void> => {
  try {
    const proxyConfigs = await window.ipcApi.getProxyList();
    const proxies: ProxyItem[] = proxyConfigs.map(config => {
      const [host, port] = (config.hostPort ?? `${config.host}:${config.port}`).split(':');
      return {
        host,
        port: parseInt(port),
        username: config.username,
        password: config.password,
        type: config.type ?? 'socks5',
      };
    });
    set({ proxies });
  } catch {
    // Failed to load proxies
  }
};

const createSaveProxies = (
  get: () => ProxyListState
) => async (): Promise<void> => {
  try {
    const state = get();
    const proxyConfigs = state.proxies.map((proxy: ProxyItem) => ({
      host: proxy.host,
      port: proxy.port,
      hostPort: `${proxy.host}:${proxy.port}`,
      auth: !!(proxy.username !== null && proxy.username !== undefined && proxy.username.length > 0 &&
               proxy.password !== null && proxy.password !== undefined && proxy.password.length > 0),
      username: proxy.username,
      password: proxy.password,
      type: proxy.type ?? 'socks5',
    }));
    await window.ipcApi.saveProxyList(proxyConfigs);
  } catch {
    // Failed to save proxies
  }
};

const createTestProxy = (
  set: (_partial: Partial<ProxyListState> | ((_state: ProxyListState) => Partial<ProxyListState>)) => void,
  get: () => ProxyListState
) => async (index: number): Promise<void> => {
  const state = get();
  const proxy = state.proxies[index];
  if (proxy === undefined || proxy === null) return;

  set((currentState: ProxyListState) => ({
    testResults: {
      ...currentState.testResults,
      [index]: { success: false, loading: true, timestamp: Date.now() }
    }
  }));

  try {
    const startTime = Date.now();
    const result = await window.ipcApi.testProxy({
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      type: proxy.type ?? 'socks5',
    });
    const responseTime = Date.now() - startTime;

    set((currentState: ProxyListState) => ({
      testResults: {
        ...currentState.testResults,
        [index]: {
          success: result.success,
          loading: false,
          error: result.success === true ? undefined : (result.error ?? 'Connection failed'),
          responseTime,
          timestamp: Date.now(),
        }
      }
    }));
  } catch (error) {
    set((currentState: ProxyListState) => ({
      testResults: {
        ...currentState.testResults,
        [index]: {
          success: false,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        }
      }
    }));
  }
};

const createUtilityActions = (
  set: (_partial: Partial<ProxyListState> | ((_state: ProxyListState) => Partial<ProxyListState>)) => void,
  get: () => ProxyListState
): {
  removeDuplicates: () => number;
  loadProxies: () => Promise<void>;
  saveProxies: () => Promise<void>;
  testProxy: (_index: number) => Promise<void>;
} => ({
  removeDuplicates: createRemoveDuplicates(set, get),
  loadProxies: createLoadProxies(set),
  saveProxies: createSaveProxies(get),
  testProxy: createTestProxy(set, get),
});

export const useProxyListStore = create<ProxyListState>((set, get) => ({
  proxies: [],
  currentProxyIndex: 0,
  testResults: {},
  isLoading: false,
  
  ...createProxyActions(set, get),
  ...createUtilityActions(set, get),


}));
