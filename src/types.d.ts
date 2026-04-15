export {};

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    checkersApi?: {
      checkForUpdates: () => Promise<{
        status: 'up-to-date' | 'downloaded' | 'unavailable' | 'checking' | 'error';
        message: string;
      }>;
      platform: string;
      versions: {
        chrome: string;
        electron: string;
        node: string;
      };
    };
  }
}
