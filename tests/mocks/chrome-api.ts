import { vi } from 'vitest';

type Listener<T = unknown> = (message: T) => void;

interface MockStorage {
  data: Map<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
}

interface MockChromeAPI {
  storage: {
    local: MockStorage;
    onChanged: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
    };
  };
  runtime: {
    onMessage: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
    };
    sendMessage: ReturnType<typeof vi.fn>;
    getURL: ReturnType<typeof vi.fn>;
    id: string;
  };
  tabs: {
    query: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    onUpdated: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
    };
    onRemoved: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
    };
  };
  sidePanel: {
    setOptions: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
  };
}

export function createMockChromeAPI(): MockChromeAPI {
  const storageData = new Map<string, unknown>();
  const messageListeners: Listener[] = [];
  const storageListeners: Listener[] = [];

  const mockStorage: MockStorage = {
    data: storageData,
    get: vi.fn(async (keys?: string | string[] | null) => {
      if (!keys) {
        const result: Record<string, unknown> = {};
        storageData.forEach((value, key) => {
          result[key] = value;
        });
        return result;
      }
      if (typeof keys === 'string') {
        return { [keys]: storageData.get(keys) };
      }
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        result[key] = storageData.get(key);
      }
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      const changes: Record<string, { newValue: unknown; oldValue?: unknown }> = {};
      for (const [key, value] of Object.entries(items)) {
        const oldValue = storageData.get(key);
        storageData.set(key, value);
        changes[key] = { newValue: value, oldValue };
      }
      // Notify listeners
      storageListeners.forEach((listener) => listener(changes));
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const keyArray = typeof keys === 'string' ? [keys] : keys;
      for (const key of keyArray) {
        storageData.delete(key);
      }
    }),
    clear: vi.fn(async () => {
      storageData.clear();
    }),
  };

  const mockChrome: MockChromeAPI = {
    storage: {
      local: mockStorage,
      onChanged: {
        addListener: vi.fn((listener: Listener) => {
          storageListeners.push(listener);
        }),
        removeListener: vi.fn((listener: Listener) => {
          const index = storageListeners.indexOf(listener);
          if (index > -1) storageListeners.splice(index, 1);
        }),
      },
    },
    runtime: {
      onMessage: {
        addListener: vi.fn((listener: Listener) => {
          messageListeners.push(listener);
        }),
        removeListener: vi.fn((listener: Listener) => {
          const index = messageListeners.indexOf(listener);
          if (index > -1) messageListeners.splice(index, 1);
        }),
      },
      sendMessage: vi.fn(async (message: unknown) => {
        for (const listener of messageListeners) {
          listener(message);
        }
      }),
      getURL: vi.fn((path: string) => `chrome-extension://mock-extension-id/${path}`),
      id: 'mock-extension-id',
    },
    tabs: {
      query: vi.fn(async () => []),
      create: vi.fn(async (options: { url: string }) => ({
        id: Math.floor(Math.random() * 10000),
        url: options.url,
      })),
      update: vi.fn(async (tabId: number, options: { active?: boolean }) => ({
        id: tabId,
        ...options,
      })),
      sendMessage: vi.fn(async () => undefined),
      onUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onRemoved: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    sidePanel: {
      setOptions: vi.fn(async () => undefined),
      open: vi.fn(async () => undefined),
    },
  };

  return mockChrome;
}

export function installMockChromeAPI(): MockChromeAPI {
  const mockChrome = createMockChromeAPI();
  (globalThis as unknown as { chrome: MockChromeAPI }).chrome = mockChrome;
  return mockChrome;
}

export function resetMockChromeAPI(mockChrome: MockChromeAPI): void {
  mockChrome.storage.local.data.clear();
  vi.clearAllMocks();
}
