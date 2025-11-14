import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    jsxInject: `import React from 'react'`
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext'
  },
  server: {
    host: true
  }
});
