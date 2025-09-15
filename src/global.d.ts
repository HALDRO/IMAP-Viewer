/**
 * @file Global type definitions
 */

import type { IIpcAPI } from './shared/types/electron';

declare global {
  interface Window {
    ipcApi: IIpcAPI;
  }
}

export {};
