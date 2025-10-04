/**
 * @file Centralized logger service using Pino.
 * Handles logging to console, file, and renderer process.
 */

import path from 'node:path'
import { Writable } from 'node:stream'

import type { BrowserWindow } from 'electron'
import pino from 'pino'

import { DATA_DIR, ensureDataDir } from './storageManager'

// Define the shape of the log object sent to the renderer
export interface UILog {
  level: number
  time: number
  pid: number
  hostname: string
  msg: string
}

let logger: pino.Logger
let mainWindow: BrowserWindow | null = null

/**
 * Initializes the global logger instance.
 * Must be called once from the main process.
 * @param browserWindow - The main browser window instance.
 */
export const initializeLogger = async (browserWindow: BrowserWindow | null): Promise<void> => {
  mainWindow = browserWindow

  // Ensure data directory exists before creating log file
  await ensureDataDir()

  const logFile = path.join(DATA_DIR, 'app.log')

  const streams: pino.StreamEntry[] = [
    // Log to the console
    { stream: process.stdout },
  ]

  // Add file stream with error handling
  try {
    const fileStream = pino.destination(logFile)
    streams.push({ stream: fileStream })
  } catch (error) {
    // If file logging fails, continue with console-only logging
    console.error('Failed to initialize file logging:', error)
  }

  // Custom stream to send logs to the renderer process
  if (mainWindow) {
    const rendererStream = new Writable({
      write(chunk, _encoding, callback) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          try {
            const logObject = JSON.parse(chunk.toString())
            // Only send logs that don't have the 'fromRenderer' flag to prevent cycles
            if (!logObject.fromRenderer) {
              mainWindow.webContents.send('log:add', logObject)
            }
          } catch (_e) {
            // ignore
          }
        }
        callback()
      },
    })
    streams.push({ stream: rendererStream })
  }

  try {
    logger = pino({ level: 'info' }, pino.multistream(streams))
    logger.info('Logger initialized')
  } catch (error) {
    // Fallback to console-only logger if multistream fails
    console.error('Failed to initialize pino multistream, falling back to console logger:', error)
    logger = pino({ level: 'info' })
    logger.info('Logger initialized (console-only fallback)')
  }
}

/**
 * Returns the logger instance.
 * Throws an error if the logger has not been initialized.
 * @returns The pino logger instance.
 */
export const getLogger = (): pino.Logger => {
  if (!logger) {
    // Fallback for environments where initializeLogger isn't called (e.g., tests)
    // This will only log to the console.
    return pino({ level: 'silent' })
  }
  return logger
}

/**
 * Logs a message from the renderer process without sending it back to prevent cycles.
 * @param level - The log level.
 * @param message - The log message.
 * @param context - Optional context object.
 */
export const logFromRenderer = (
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: object
): void => {
  if (!logger) {
    return
  }

  try {
    // Create a child logger with fromRenderer flag to prevent cycles
    const rendererLogger = logger.child({ fromRenderer: true })

    if (context) {
      rendererLogger[level](context, message)
    } else {
      rendererLogger[level](message)
    }
  } catch (error) {
    // Fallback to console logging if pino fails
    console.error('Failed to log from renderer, falling back to console:', error)
    console[level](`[Renderer] ${message}`, context || '')
  }
}
