/**
 * @file This panel acts as a container for either the email list view or the email content view.
 * @description Manages display of two main viewing modes:
 * - Email list (EmailListView) - when no email is selected
 * - Email viewing (EmailViewer) - when email is selected
 *
 * Browser handling:
 * - Browser is rendered separately in Layout.tsx, NOT here
 * - This panel only provides BrowserContext for opening links from emails
 * - Browser is in separate container above EmailViewPanel to prevent remounting on account switch
 *
 * BrowserContext provides resilient API with fallback to UIStore if Provider is not available,
 * ensuring EmailViewer can work in any rendering context.
 * Supports link interception through context and provides smooth transitions between modes.
 */
import { AnimatePresence, motion } from 'framer-motion'
import React, { createContext, useContext } from 'react'

import { useAccountStore } from '../shared/store/accounts/accountStore'
import { useUIStore } from '../shared/store/uiStore'

import EmailListView from './EmailListView'
import EmailViewer from './EmailViewer'
import SettingsView from './SettingsPanel/SettingsView'

interface EmailViewPanelProps {
  searchQuery?: string
}

// Context for passing browser opening function to EmailViewer
// Falls back to UIStore if context is not available for resilience
interface BrowserContextType {
  openUrl: (url: string) => void
}

const BrowserContext = createContext<BrowserContextType | undefined>(undefined)

export const useBrowserContext = (): BrowserContextType => {
  const context = useContext(BrowserContext)
  if (!context) {
    // Fallback to UIStore if context is not available
    // This ensures EmailViewer can work even if rendered outside Provider
    return {
      openUrl: (url: string) => {
        useUIStore.getState().openBrowser(url)
      },
    }
  }
  return context
}

const EmailViewPanel: React.FC<EmailViewPanelProps> = React.memo(({ searchQuery = '' }) => {
  const selectedEmailId = useAccountStore(state => state.selectedEmailId)
  const { isSettingsOpen, openBrowser } = useUIStore()

  const handleOpenUrl = (url: string) => {
    openBrowser(url)
  }

  return (
    <BrowserContext.Provider value={{ openUrl: handleOpenUrl }}>
      <div className="h-full w-full bg-background relative">
        {/* Settings Panel - above browser (--z-settings: 30) */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="absolute inset-0 z-[var(--z-settings)] bg-card rounded-l-xl"
            >
              <SettingsView />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content area (--z-base: 0) */}
        <div className="absolute inset-0 z-[var(--z-base)]">
          {selectedEmailId !== null && selectedEmailId !== undefined ? (
            <EmailViewer />
          ) : (
            <EmailListView searchQuery={searchQuery} />
          )}
        </div>
      </div>
    </BrowserContext.Provider>
  )
})

export default EmailViewPanel
