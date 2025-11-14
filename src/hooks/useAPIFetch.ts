import { useCallback, useState } from 'react';
import type { ApiResponse } from '../types/api';

async function fetchWithRetry<T>(url: string, retries = 2, init?: RequestInit): Promise<ApiResponse<T>> {
  let attempt = 0;
  let lastError: unknown;
  const jitter = () => Math.random() * 200;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      const response = await fetch(url, { ...init, signal: controller.signal, headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      } });
      clearTimeout(timeout);
      if (!response.ok) {
        lastError = new Error(`status-${response.status}`);
      } else {
        const json = (await response.json()) as ApiResponse<T>;
        return json;
      }
    } catch (error) {
      lastError = error;
    }
    attempt += 1;
    if (attempt <= retries) {
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt + jitter()));
    }
  }
  return { ok: false, error: lastError instanceof Error ? lastError.message : 'network-error' };
}

export function useAPIFetch<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const request = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    const result = await fetchWithRetry<T>(url);
    if (result.ok && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? 'unknown-error');
      setData(null);
    }
    setLoading(false);
    return result;
  }, []);

  return { data, loading, error, request };
}
