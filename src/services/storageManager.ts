/**
 * @file Manages the basic data storage infrastructure (directories and files).
 */
import { promises as fsPromises } from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

import { getLogger } from './logger'

// Define file paths relative to the application root
const getBasePath = (): string => {
  return app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()
}

export const DATA_DIR = path.join(getBasePath(), 'data')

// Track if infrastructure has been initialized to avoid repeated calls
let dataDirInitialized = false

/**
 * Ensures that the main data directory exists.
 */
export const ensureDataDir = async (): Promise<void> => {
  if (dataDirInitialized) {
    return
  }
  try {
    await fsPromises.mkdir(DATA_DIR, { recursive: true })
    dataDirInitialized = true
  } catch (error) {
    const logger = getLogger()
    logger.error({ error }, 'Failed to create data directory')
    throw error // Re-throw to let callers handle it
  }
}

/**
 * Ensures a specific file exists within the data directory.
 * If the file doesn't exist, it's created with default content.
 * @param filePath The full path to the file.
 */
export const ensureFileExists = async (filePath: string): Promise<void> => {
  await ensureDataDir() // First, make sure the directory is there
  try {
    await fsPromises.access(filePath)
  } catch {
    try {
      const content = filePath.endsWith('.json') ? '{}' : ''
      await fsPromises.writeFile(filePath, content, 'utf-8')
      const logger = getLogger()
      logger.info({ file: path.basename(filePath) }, 'Created new data file')
    } catch (writeError) {
      const logger = getLogger()
      logger.error({ error: writeError, file: filePath }, 'Failed to create data file')
      throw writeError
    }
  }
}
