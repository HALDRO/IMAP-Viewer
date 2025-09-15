/**
 * @file Renderer-side logger proxy.
 * Provides a simple interface for components to send logs to the main process.
 */

import type { Level } from 'pino';

/**
 * Sends a log message to the main process for handling.
 * @param level - The log level.
 * @param message - The log message.
 * @param context - Optional context object.
 */
function log(level: 'info' | 'warn' | 'error', message: string, context?: object): void {
  window.ipcApi.logMessage(level, message, context);
}

export const logger = {
  info: (message: string, context?: object): void => {
    log('info', message, context);
  },
  warn: (message: string, context?: object): void => {
    log('warn', message, context);
  },
  error: (message: string, context?: object): void => {
    log('error', message, context);
  },
};