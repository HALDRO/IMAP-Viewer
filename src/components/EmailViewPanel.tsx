/**
 * @file This panel acts as a container for either the email list view or the email content view.
 */
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';

import { useAccountStore } from '../shared/store/accounts/accountStore';
import { useUIStore } from '../shared/store/uiStore';

import EmailListView from './EmailListView';
import EmailViewer from './EmailViewer';
import SettingsView from './SettingsPanel/SettingsView';

interface EmailViewPanelProps {
  searchQuery?: string;
}

const EmailViewPanel: React.FC<EmailViewPanelProps> = React.memo(({ searchQuery = '' }) => {
  const selectedEmailId = useAccountStore((state) => state.selectedEmailId);
  const { isSettingsOpen } = useUIStore();

  return (
    <div className="h-full w-full bg-background relative">
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="absolute inset-0 z-20 bg-card rounded-l-xl"
          >
            <SettingsView />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 z-0">
        {selectedEmailId !== null && selectedEmailId !== undefined ? <EmailViewer /> : <EmailListView searchQuery={searchQuery} />}
      </div>
    </div>
  );
});

export default EmailViewPanel;