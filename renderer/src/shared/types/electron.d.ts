/// <reference types="vite/client" />

declare global {
  interface Window {
    KC?: {
      getVersion?: () => Promise<string>;
    };
  }
}

export {};