/**
 * @file Confirmation dialog for comprehensive browser data clearing with anti-fingerprinting
 * @description Displays detailed warning dialog before executing complete browser data wipe across all partitions.
 * Comprehensive clearing includes: all storage types (cookies, cache, localStorage, IndexedDB, service workers),
 * fingerprinting vectors (WebGL shader cache, DNS cache, code caches), authentication data, and both browser partitions
 * (main in-app browser + external windows). Prevents accidental data loss through explicit multi-step user confirmation
 * with detailed breakdown of what will be cleared. Essential for privacy-conscious users and anti-tracking workflows.
 */
import { Eraser } from 'lucide-react'
import type React from 'react'

import { Button } from '../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../shared/ui/dialog'

interface ClearBrowserDataDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

/**
 * Confirmation dialog for clearing browser data
 */
export const ClearBrowserDataDialog: React.FC<ClearBrowserDataDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const handleConfirm = (): void => {
    onConfirm()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10">
              <Eraser className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <DialogTitle>Clear Browser Data</DialogTitle>
              <DialogDescription className="mt-1">
                This will reset the browser to a clean state
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogDescription className="sr-only">
          Confirmation dialog for clearing all browser data including cookies, cache, and sessions.
        </DialogDescription>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Complete anti-fingerprinting cleanup across all browser contexts:
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">Storage & Cache</p>
              <ul className="space-y-1 text-sm text-muted-foreground ml-3">
                <li>• All cookies (session + persistent)</li>
                <li>• HTTP cache (images, scripts, fonts)</li>
                <li>• localStorage, sessionStorage, IndexedDB</li>
                <li>• Service Workers, Cache API</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">Fingerprinting Vectors</p>
              <ul className="space-y-1 text-sm text-muted-foreground ml-3">
                <li>• WebGL shader cache</li>
                <li>• DNS/Host resolver cache</li>
                <li>• JavaScript/WASM code caches</li>
                <li>• HTTP authentication credentials</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">Browser Contexts</p>
              <ul className="space-y-1 text-sm text-muted-foreground ml-3">
                <li>• Main browser partition</li>
                <li>• External browser windows partition</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium text-yellow-600 dark:text-yellow-500">
            ⚠️ You will be logged out from ALL websites
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="bg-yellow-600 hover:bg-yellow-700 text-white">
            Clear Data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
