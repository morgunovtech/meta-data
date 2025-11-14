import { useCallback, useState } from 'react';
import type { ProxyResponse } from '../types/api';

const DEFAULT_RETRY = 2;
const BASE_DELAY = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Options<T> {
  path: string;
  params?: Record<string, string | number | undefined>;
  onSuccess?: (data: T) => void;
}

export const useAPIFetch = <T,>() => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(
    async ({ path, params, onSuccess }: Options<T>) => {
      setLoading(true);
      setError(null);
      let attempt = 0;
      while (attempt <= DEFAULT_RETRY) {
        try {
          const url = new URL(path, window.location.origin);
          if (params) {
            Object.entries(params).forEach(([key, value]) => {
              if (value === undefined) return;
              url.searchParams.set(key, String(value));
            });
          }
          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });
          if (!response.ok) {
            throw new Error(`status_${response.status}`);
          }
          const json = (await response.json()) as ProxyResponse<T>;
          if (!json.ok || !json.data) {
            throw new Error(json.error ?? 'proxy_error');
          }
          setData(json.data);
          onSuccess?.(json.data);
          setLoading(false);
          return json.data;
        } catch (err) {
          attempt += 1;
          if (attempt > DEFAULT_RETRY) {
            setError(err instanceof Error ? err.message : 'unknown');
            setLoading(false);
            return null;
          }
          const jitter = Math.random() * 150;
          await sleep(BASE_DELAY * attempt + jitter);
        }
      }
      setLoading(false);
      return null;
    },
    []
  );

  return { execute, loading, error, data };
};
