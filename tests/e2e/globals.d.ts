/// <reference lib="dom" />
import type { PreloadBridge } from '../../src/shared/ipc';

declare global {
  interface Window {
    fc: PreloadBridge;
  }
}
