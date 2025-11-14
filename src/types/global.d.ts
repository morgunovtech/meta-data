interface CocoSsdModule {
  load(options?: { base?: string }): Promise<{
    detect: (img: HTMLImageElement | HTMLCanvasElement | ImageBitmap, maxResults?: number) => Promise<any[]>;
  }>;
}

declare global {
  interface Window {
    cocoSsd?: CocoSsdModule;
  }
}

export {};
