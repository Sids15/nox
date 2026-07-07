import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query is the single source of server state. The client is persisted to durable
 * device storage so reads survive crashes/restarts (offline-tolerant). Cached content is stored
 * in the app sandbox; encrypting the cache at rest is a v2 hardening item (see rules.md).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24, // keep for a day so the persisted cache stays useful offline
      retry: 2,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 2,
      // Always fire the first attempt optimistically; if the network is unreachable, pause and queue
      // the write instead of erroring + rolling back, so offline edits survive to reconnect. Requires
      // onlineManager to be wired to real connectivity — see setupOnlineManager in online.ts.
      networkMode: "offlineFirst",
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "nox:query-cache",
  throttleTime: 1000,
});
