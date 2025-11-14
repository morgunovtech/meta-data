export interface PagesEventContext<Env = unknown> {
  request: Request;
  env: Env;
  params: Record<string, string>;
}

export type CfRequestInit = RequestInit & { cf?: { cacheTtl?: number; cacheEverything?: boolean } };
