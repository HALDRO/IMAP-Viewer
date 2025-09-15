# Metacharts Project Map (High-Level Index)
# Auto-generated: 2025-08-02T15:21:58.876Z
# Purpose: Provides a high-level overview for AI navigation and developer onboarding.
# Stats: 121 files, ~18k lines, ~615k chars, ~~154k tokens

> Legend: An ellipsis (…) at the end of a description means it was truncated. Read the file for full details.

## `./`
- `components.json`: No description found.
- `package.json`: No description found.
- `tsconfig.json`: No description found.

## `src/`
- `app.tsx`: No description found.
- `main.ts`: No description found.
- `preload.ts`: Preload script for the renderer process.. Exposes a safe, type-strong API to the renderer for interacting with the main process.
- `renderer.tsx`: No description found.

## `src/components/`
- `DataFilesMenu.tsx`: Context menu for accessing data files. /
- `DeleteAllAccountsDialog.tsx`: Confirmation dialog for deleting all accounts. /
- `EmailAttachments.tsx`: No description found.
- `EmailListPanel.tsx`: Panel that contains the list of mailboxes.. /
- `EmailListSkeleton.tsx`: Component that shows a loading skeleton for the email list.. /
- `EmailListView.tsx`: Renders the list of emails with infinite scroll, search filtering, and modern design.. /
- `EmailViewer.tsx`: No description found.
- `EmailViewPanel.tsx`: This panel acts as a container for either the email list view or the email content view.. /
- `ErrorBoundary.tsx`: Error boundary component for catching and displaying React errors gracefully. /
- `ExpiredTokenNotification.tsx`: Component for notifying users about expired OAuth2 tokens. /
- `FormField.tsx`: Accessible form field components with validation using ShadCN UI. /
- `ImportDialog.tsx`: Simple import dialog for account files with drag-and-drop. /
- `Layout.tsx`: The main layout component using react-resizable-panels.. It sets up the three-panel view for the application.
- `LoadingSpinner.tsx`: Loading spinner component with accessibility features using ShadCN UI. /
- `LogPanel.tsx`: A persistent sidebar panel for displaying application logs.. /
- `RelativeTime.tsx`: No description found.

## `src/components/AccountManager/`
- `AccountForm.tsx`: Refactored account form component for a better user experience.. /
- `AccountList.tsx`: Account list component for displaying and managing accounts. /
- `AccountManagerPanel.tsx`: Panel for managing email accounts with a modern dark design. /
- `ActionButtons.tsx`: Action buttons component for account management. /
- `ContextMenu.tsx`: Context menu component for account actions. /
- `DragDropZone.tsx`: Drag and drop zone component for importing account files. /
- `index.ts`: Entry point for AccountManager components. /
- `UndoNotification.tsx`: Undo notification component for deleted accounts. /

## `src/components/SettingsPanel/`
- `MainSettings.tsx`: Main application settings component. /
- `ProxyAddForm.tsx`: Proxy add form component. /
- `ProxyAddFormComponents.tsx`: Proxy add form sub-components. /
- `ProxyAdvancedSettings.tsx`: Proxy advanced settings component. /
- `ProxyAdvancedSettingsComponents.tsx`: Proxy advanced settings sub-components. /
- `ProxyImportPanel.tsx`: Proxy import panel component. /
- `ProxyList.tsx`: Proxy list component. /
- `ProxySettings.tsx`: Modern proxy settings component with intuitive interface for all use cases.. /
- `ProxyStatusHeader.tsx`: Proxy status header component. /
- `SettingsView.tsx`: Component for displaying settings directly in the main content area. /

## `src/ipc/`
- `account.ts`: No description found.
- `clipboard.ts`: IPC handlers for clipboard operations. /
- `config.ts`: IPC handlers for user configuration management. /
- `files.ts`: IPC handlers for file system operations. /
- `imapFlow.ts`: No description found.
- `index.ts`: Entry point for registering all IPC handlers.. It imports handlers from different files and registers them with the main process.
- `proxy.ts`: No description found.

## `src/services/`
- `accountImportService.ts`: High-performance account import service with data normalization. Handles parsing and normalization of IMAP account data from various formats
- `autoDiscoveryService.ts`: Service for auto-discovering email server settings, now with parallel execution and caching.. /
- `clipboardService.ts`: Service for clipboard operations and credential parsing. /
- `connectionManager.ts`: Simple IMAP connection manager. /
- `emailSanitizationService.ts`: Email content sanitization service. Simple service for handling email content display
- `imapFlowService.ts`: Service for handling IMAP connections and operations using ImapFlow.. /
- `instantImportService.ts`: Instant import service with background DNS discovery. Imports accounts immediately and discovers server settings in background
- `logger.ts`: Centralized logger service using Pino.. Handles logging to console, file, and renderer process.
- `msalService.ts`: No description found.
- `oauthAccountParser.ts`: Specialized parser for Microsoft OAuth2 account format. Handles parsing of format: email:password:refresh_token:client_id with various…
- `storeService.ts`: Service for managing storage using simple text files.. This stores everything in the application's root directory for portability.
- `tokenManager.ts`: Simple OAuth2 token manager. /

## `src/services/discovery/`
- `connectionTesting.ts`: Connection testing utilities for email discovery. /
- `dnsDiscovery.ts`: DNS-based email discovery using modern techniques.. /
- `exchangeDiscovery.ts`: Microsoft Exchange Autodiscover implementation using modern techniques.. /
- `providerDiscovery.ts`: Provider-based email discovery. /
- `types.ts`: Types for email discovery services. /

## `src/shared/hooks/`
- `useAccountForm.ts`: Hook for managing account form state and logic with improved validation.. /
- `useAccountInitializer.ts`: Simple hook for managing application initialization. /
- `useAccountManager.ts`: Hook for managing account operations and state. /
- `useAppInitialization.ts`: Hook for managing application initialization. /
- `useEmailDiscovery.ts`: Hook for email server auto-discovery functionality. /
- `useEmailList.ts`: Hook for managing email list operations and state. /
- `useEmailViewer.ts`: Hook for managing email viewer functionality. /
- `useKeyboardNavigation.ts`: Custom hook for keyboard navigation support. /
- `useMailboxManager.ts`: Hook for managing mailbox functionality. /
- `useProxyManager.ts`: Hook for managing proxy operations and state. /
- `useProxyStatus.ts`: Hook for managing proxy status functionality. /
- `useRelativeTime.ts`: No description found.

## `src/shared/store/`
- `imapProviders.ts`: Contains a list of common email provider IMAP settings.. This is used for autodetecting server settings when a user adds an account.
- `logStore.ts`: Zustand store for managing a persistent log of application events.. /
- `mainSettingsStore.ts`: Main application settings store. /
- `proxyListStore.ts`: Zustand store for managing proxy list state.. /
- `proxyStore.ts`: Zustand store for managing global proxy state.. /
- `uiStore.ts`: No description found.

## `src/shared/store/accounts/`
- `accountStore.ts`: Focused Zustand store for account CRUD operations. /
- `connectionStore.ts`: Focused Zustand store for connection status management. /
- `emailStore.ts`: Focused Zustand store for email data management. /
- `index.ts`: Exports for focused account-related stores. /
- `mailboxStore.ts`: Focused Zustand store for mailbox management. /

## `src/shared/types/`
- `account.ts`: Account types and schemas for email account management. /
- `electron.ts`: Electron type definitions for IPC communication. /
- `email.ts`: Email types for headers and content. /
- `protocol.ts`: Protocol types for email server configuration and discovery. /

## `src/shared/ui/`
- `avatar.tsx`: Simple avatar component without Radix UI dependency. /
- `badge.tsx`: No description found.
- `button.tsx`: No description found.
- `card.tsx`: No description found.
- `checkbox.tsx`: No description found.
- `custom-scrollbar.tsx`: Custom scrollbar component with modern design. /
- `dialog.tsx`: No description found.
- `dropdown-menu.tsx`: Dropdown menu component built on top of Radix UI. /
- `index.ts`: Entry point for UI components. /
- `input.tsx`: No description found.
- `label.tsx`: No description found.
- `progress.tsx`: No description found.
- `select.tsx`: No description found.
- `settings-section.tsx`: Universal settings section component for consistent layout and styling. /
- `skeleton.tsx`: Skeleton loading component using ShadCN UI. /
- `sonner.tsx`: No description found.
- `switch.tsx`: No description found.
- `tabs.tsx`: No description found.
- `theme-provider.tsx`: No description found.
- `Toast.tsx`: Toast notification system using Sonner with ShadCN UI integration. /
- `toggle-group.tsx`: No description found.
- `toggle.tsx`: No description found.
- `tooltip.tsx`: No description found.
- `top-bar-account-section.tsx`: Account section component for the top bar. /
- `top-bar.tsx`: Unified top bar component for consistent application header. /

## `src/shared/utils/`
- `emailProcessing.ts`: Email processing utilities. /
- `imapErrorHandling.ts`: IMAP error handling utilities. /
- `logger.ts`: Renderer-side logger proxy.. Provides a simple interface for components to send logs to the main process.
- `utils.ts`: Utility functions for ShadCN UI components and general use. /