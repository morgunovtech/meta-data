import { useCallback, useState } from 'react';
import type { ApiResponse } from '../types/api';

const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useAPIFetch<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [data, setData] = useState<T | undefined>();

  const call = useCallback(async (path: string, params: RequestInit = {}) => {
    setLoading(true);
    setError(undefined);

    for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
      try {
        const response = await fetch(path, {
          ...params,
          headers: {
            'content-type': 'application/json',
            ...(params.headers ?? {})
          }
        });

        const json = (await response.json()) as ApiResponse<T>;
        if (!json.ok) {
          throw new Error(json.error ?? 'error');
        }
        setData(json.data);
        setLoading(false);
        return json.data;
      } catch (err) {
        if (attempt === RETRY_COUNT) {
          setError((err as Error).message);
          setLoading(false);
          return undefined;
        }
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
    setLoading(false);
    return undefined;
  }, []);

  return { call, loading, error, data, setData } as const;
}
