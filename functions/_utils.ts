export type JsonResponse<T> = Response;

export function respond<T>(payload: { ok: boolean; data?: T; error?: string }, init?: ResponseInit): JsonResponse<T> {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      ...(init?.headers ?? {})
    }
  });
}

export function badRequest(message: string) {
  return respond({ ok: false, error: message }, { status: 400 });
}

export async function fetchJson<T>(input: RequestInfo, init?: RequestInit, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        'user-agent': 'meta-data-privacy-tool/1.0 (+https://github.com/)',
        accept: 'application/json',
        ...(init?.headers ?? {})
      }
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const json = (await response.json()) as T;
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}
