export {};

declare global {
  interface Window {
    checkersApi?: {
      platform: string;
      versions: {
        chrome: string;
        electron: string;
        node: string;
      };
    };
  }
}
