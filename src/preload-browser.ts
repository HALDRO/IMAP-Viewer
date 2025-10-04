/**
 * @file Preload script for WebContentsView browser
 * @description Injects click handler to detect middle-click and Ctrl+Click on links
 * and sends IPC message to main process to open in new window. This is necessary because
 * setWindowOpenHandler's disposition parameter doesn't distinguish between:
 * - Regular click on target="_blank" link (disposition: 'foreground-tab')
 * - Middle-click on any link (disposition: 'foreground-tab')
 * - Ctrl+Click on any link (disposition: 'foreground-tab')
 *
 * Architecture: Renderer (WebContentsView) → IPC → Main Process → Create BrowserWindow
 */

import { contextBridge, ipcRenderer } from 'electron'

// Wait for DOM to be ready
window.addEventListener('DOMContentLoaded', () => {
  // Intercept clicks on links
  document.addEventListener(
    'click',
    (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href || (!href.startsWith('http://') && !href.startsWith('https://'))) return

      // Check if user intends to open in new window
      const isMiddleClick = event.button === 1 // Middle mouse button
      const isCtrlClick = event.ctrlKey || event.metaKey // Ctrl (Windows/Linux) or Cmd (Mac)
      const isShiftClick = event.shiftKey

      if (isMiddleClick || isCtrlClick || isShiftClick) {
        // User wants to open in new window
        event.preventDefault()
        event.stopPropagation()

        // Send IPC message to main process to open in new window
        ipcRenderer.send('browser:open-external-window', href)
      }
      // For regular clicks (including target="_blank"), do nothing
      // setWindowOpenHandler in main.ts will handle it
    },
    true // Use capture phase to intercept before other handlers
  )

  // Also handle auxclick event for middle mouse button (more reliable)
  document.addEventListener(
    'auxclick',
    (event: MouseEvent) => {
      if (event.button !== 1) return // Only middle button

      const target = (event.target as HTMLElement).closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href || (!href.startsWith('http://') && !href.startsWith('https://'))) return

      event.preventDefault()
      event.stopPropagation()

      // Send IPC message to main process to open in new window
      ipcRenderer.send('browser:open-external-window', href)
    },
    true
  )
})

// Expose minimal API to renderer if needed (currently not used)
contextBridge.exposeInMainWorld('browserApi', {
  // Reserved for future use
})
