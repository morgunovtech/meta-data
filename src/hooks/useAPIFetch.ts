import { useCallback, useRef, useState } from 'react';
import type { ApiResponse } from '../types/api';

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

async function fetchWithRetry<T>(url: string, retries = 2, init?: RequestInit, signal?: AbortSignal): Promise<ApiResponse<T>> {
  let attempt = 0;
  let lastError: unknown;
  const jitter = () => Math.random() * 200;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);

      // Link external signal
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort);

      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {})
        }
      });
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);

      if (!response.ok) {
        lastError = new Error(`status-${response.status}`);
        // Don't retry client errors (except 429)
        if (!RETRYABLE_STATUS.has(response.status)) {
          break;
        }
      } else {
        const json = (await response.json()) as ApiResponse<T>;
        return json;
      }
    } catch (error) {
      if (signal?.aborted) {
        return { ok: false, error: 'aborted' };
      }
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
  const abortRef = useRef<AbortController | null>(null);

  const base = import.meta.env.VITE_FUNCTIONS_BASE ?? '';

  const request = useCallback(async (url: string, init?: RequestInit) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    const target = url.startsWith('http://') || url.startsWith('https://') ? url : `${base}${url}`;
    const result = await fetchWithRetry<T>(target, 2, init, controller.signal);

    if (controller.signal.aborted) return result;

    if (result.ok && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? 'unknown-error');
      setData(null);
    }
    setLoading(false);
    return result;
  }, [base]);

  return { data, loading, error, request };
}
