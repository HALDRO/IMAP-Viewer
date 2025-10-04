/**
 * @file IPC handlers for clipboard operations
 */
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import type { Logger } from 'pino'

import { ClipboardService } from '../services/clipboardService'
import type { ClipboardParseResult, CredentialsParseResult } from '../shared/types/electron'

export const registerClipboardHandlers = (ipcMain: IpcMain, logger: Logger): void => {
  // Detect credentials from clipboard
  ipcMain.handle(
    'clipboard:detect-credentials',
    async (_event: IpcMainInvokeEvent): Promise<ClipboardParseResult> => {
      try {
        const result = await ClipboardService.detectCredentialsFromClipboard()
        logger.info({ success: result.success }, 'Clipboard credentials detection completed')
        return result
      } catch (error) {
        const errorMsg = `Failed to detect credentials from clipboard: ${error instanceof Error ? error.message : String(error)}`
        logger.error(errorMsg)
        return { success: false, error: errorMsg }
      }
    }
  )

  // Parse credentials string
  ipcMain.handle(
    'clipboard:parse-credentials',
    async (_event: IpcMainInvokeEvent, text: string): Promise<CredentialsParseResult> => {
      try {
        const result = await ClipboardService.parseCredentialsString(text)
        logger.info({ success: result.success }, 'Credentials string parsing completed')
        return result
      } catch (error) {
        const errorMsg = `Failed to parse credentials string: ${error instanceof Error ? error.message : String(error)}`
        logger.error(errorMsg)
        return { success: false, error: errorMsg }
      }
    }
  )

  // Copy account credentials to clipboard
  ipcMain.handle(
    'clipboard:copy-credentials',
    async (_event: IpcMainInvokeEvent, email: string, password: string): Promise<boolean> => {
      try {
        const success = await ClipboardService.copyAccountCredentials(email, password)
        logger.info({ success }, 'Account credentials copy completed')
        return success
      } catch (error) {
        const errorMsg = `Failed to copy account credentials: ${error instanceof Error ? error.message : String(error)}`
        logger.error(errorMsg)
        return false
      }
    }
  )
}
