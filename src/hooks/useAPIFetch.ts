import { useCallback, useState } from 'react';
import type { ApiResponse } from '@/types/api';

export type FetchState<T> = {
  loading: boolean;
  error?: string;
  data?: T;
};

const DEFAULT_RETRIES = 2;

export const useAPIFetch = <T,>() => {
  const [state, setState] = useState<FetchState<T>>({ loading: false });

  const fetchWithRetry = useCallback(
    async (input: string | URL, init?: RequestInit, retries = DEFAULT_RETRIES) => {
      setState({ loading: true });
      let attempt = 0;
      let lastError: Error | undefined;
      const controller = new AbortController();
      const requestInit: RequestInit = {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(init?.headers ?? {})
        }
      };

      while (attempt <= retries) {
        try {
          const started = performance.now();
          const response = await fetch(input, requestInit);
          const duration = performance.now() - started;
          const json = (await response.json()) as ApiResponse<T>;
          if (!response.ok || !json.ok) {
            throw new Error(json.ok ? `HTTP ${response.status}` : json.error);
          }
          setState({ loading: false, data: json.data });
          return { data: json.data, duration };
        } catch (error) {
          lastError = error as Error;
          attempt += 1;
          if (attempt > retries) {
            setState({ loading: false, error: lastError?.message ?? 'unknown error' });
            return { error: lastError };
          }
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        }
      }
      setState({ loading: false, error: lastError?.message ?? 'unknown error' });
      return { error: lastError };
    },
    []
  );

  const reset = useCallback(() => setState({ loading: false }), []);

  return { ...state, fetchWithRetry, reset };
};
