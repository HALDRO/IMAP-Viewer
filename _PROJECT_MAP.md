# Metacharts Project Map (High-Level Index)
# Auto-generated: 2025-10-04T17:40:01.884Z
# Purpose: Provides a high-level overview for AI navigation and developer onboarding.
# Stats: 129 files, ~24k lines, ~775k chars, ~~194k tokens

> Legend: An ellipsis (…) at the end of a description means it was truncated. Read the file for full details.

## `./`
- `components.json`: No description found.
- `package.json`: No description found.
- `tsconfig.json`: No description found.

## `src/`
- `app.tsx`: No description found.
- `main.ts`: Electron main process - application entry point, window and WebContentsView management (Main Electron process responsible for: - Creating and managing main application window with security configuration (default: 1280x900, minimum: 900x700) - Managing WebContentsView for modern in-app browsing (latest Electron API) - Handling external link…
- `preload-browser.ts`: Preload script for WebContentsView browser (Injects click handler to detect middle-click and Ctrl+Click on links and sends IPC message to main process to open in new window. This is necessary because setWindowOpenHandler's disposition parameter doesn't distinguish between: - Regular click on target="_blank" link (disposition: 'foreground-tab') -…
- `preload.ts`: Preload script for the renderer process. Exposes a safe, type-strong API to the renderer for interacting with the main process.
- `renderer.tsx`: No description found.

## `src/components/`
- `ClearBrowserDataDialog.tsx`: Confirmation dialog for comprehensive browser data clearing with anti-fingerprinting (Displays detailed warning dialog before executing complete browser data wipe across all partitions. Comprehensive clearing includes: all storage types (cookies, cache, localStorage, IndexedDB, service workers), fingerprinting vectors (WebGL shader cache, DNS…
- `DeleteAllAccountsDialog.tsx`: Confirmation dialog for deleting all accounts
- `EmailAttachments.tsx`: No description found.
- `EmailListPanel.tsx`: Panel that contains the list of mailboxes with collapsible support (Displays email folders with two view modes: - Expanded: Full view with folder names, counts, and controls - Collapsed: Compact icon-only view (80px width) showing only folder icons Supports folder refresh, search filtering, and adaptive UI based on collapsed state.)
- `EmailListSkeleton.tsx`: Component that shows a loading skeleton for the email list.
- `EmailListView.tsx`: Renders the list of emails with pagination, search filtering, and smart multi-select functionality. (Email list component with smart view and selection mode management: - Regular click on email opens it for viewing (selectEmail → AccountStore) - Checkbox click activates multi-select mode (handleCheckboxSelect) - Mode automatically deactivates when…
- `EmailRenderer.tsx`: Enhanced Email Renderer (Advanced email content renderer with support for various email formats. Uses DOMPurify for sanitization and applies email-client-specific fixes. Handles HTML emails, plain text, and structured content with proper styling.)
- `EmailViewer.tsx`: No description found.
- `EmailViewPanel.tsx`: This panel acts as a container for either the email list view or the email content view. (Manages display of two main viewing modes: - Email list (EmailListView) - when no email is selected - Email viewing (EmailViewer) - when email is selected Browser handling: - Browser is rendered separately in Layout.tsx, NOT here - This panel only provides…
- `ErrorBoundary.tsx`: Error boundary component for catching and displaying React errors gracefully
- `ImportDialog.tsx`: Simple import dialog for account files with drag-and-drop
- `InAppBrowser.tsx`: Modern in-app browser component using WebContentsView API (Uses latest Electron WebContentsView (replaces deprecated BrowserView and <webview>). - Primary goal: Enable users to interact with email links without losing context - WebContentsView runs in separate process (main) - superior security and stability - All navigation handled via IPC -…
- `Layout.tsx`: Main layout component with shadcn resizable panels architecture (Fully unified three-level resizable panel architecture using only shadcn components (ResizablePanel/ResizablePanelGroup/ResizableHandle): Layout structure: - Level 1 (horizontal): Main area + Right account panel - Level 2 (vertical): Content + Log panel - Level 3 (horizontal): Left…
- `LogPanel.tsx`: A persistent sidebar panel for displaying application logs.
- `ProxyStatusWidget.tsx`: Proxy status widget for sidebar with quick toggle (Simple widget showing proxy on/off state with toggle switch. Displays proxy details (type, host:port, IP) only in tooltip on hover. Allows quick enable/disable without navigating to settings. Fixed at bottom of left sidebar.)
- `RelativeTime.tsx`: No description found.

## `src/components/AccountManager/`
- `AccountForm.tsx`: Refactored account form component for a better user experience.
- `AccountList.tsx`: Unified account list component with stable hover effects and anti-sticking protection (Component with fully unified interface and reliable hover state management: - In collapsed mode: main container with justify-center centers the entire account element, visual elements (avatars/indexes) are additionally centered within their containers, hover…
- `AccountManagerPanel.tsx`: Account management panel with unified behavior and Portal-based ActionButtons (React component with fully identical behavior in both states: - Collapsed mode: compact layout with 1px left border (border-l) when ResizeHandle is hidden ActionButtons rendered via Portal outside narrow Panel container for full interactivity - Expanded mode: full…
- `ActionButtons.tsx`: Action buttons component for account management panel with fixed 56px height (Container for "Add" and "Import" buttons, integrated into AccountManagerPanel. FEATURES: - Fixed 56px container height in both collapsed and expanded modes - Collapsed mode: ultra-compact 24x24px icon buttons (h-6 w-6) with 13px icons Outer container: px-1.5 (6px horiz)…
- `ContextMenu.tsx`: Context menu component for account actions using ShadCN DropdownMenu (Portal-based dropdown menu positioned at cursor location on right-click)
- `DragDropZone.tsx`: Drag and drop zone component for importing account files (Wrapper component that handles file drag-and-drop functionality. Supports ref forwarding for positioning calculations in collapsed mode. Accepts .txt and .csv files for account import.)
- `index.ts`: Entry point for AccountManager components
- `UndoNotification.tsx`: Undo notification component for deleted accounts

## `src/components/SettingsPanel/`
- `MainSettings.tsx`: Unified component for main application settings (Modernized main settings in ProxyConfiguration style with Switches, tooltip-icons and gradient headers. Includes Interface and Account sections without SettingsSection frames in unified modern style.)
- `ProxyComponents.tsx`: Unified file of all proxy configuration components with complete unification (Combined components for proxy configuration: status header, add form, advanced settings (randomization, manual source fetching), test settings, import panel. Eliminates code duplication and provides centralized architecture for all proxy components in one place.…
- `ProxyList.tsx`: Proxy management component with optimized table, pagination and proxy selection. (Unified component for managing proxy servers with pagination for performance. Includes import, test all proxies, and export buttons. Displays proxies in structured table with columns Select, Type, IP Address, Port, Auth, Status and Actions. Supports working with…
- `ProxySettings.tsx`: Modern proxy settings component with intuitive interface for all use cases (Main proxy settings component orchestrating proxy configuration, testing, import/export, and list management. Coordinates between useProxyManager, useProxyForm, and useProxyStatus hooks. Provides UI for manual proxy operations - adding, testing, fetching from sources, and…
- `SettingsView.tsx`: Component for displaying settings directly in the main content area (Settings panel with tabbed navigation (Main/Proxy), keyboard shortcuts (Escape to close), and action buttons (reset config, close). Uses shadcn Tabs for consistent UI and proper accessibility. Implements cleanup for event listeners to prevent memory leaks.)

## `src/ipc/`
- `account.ts`: No description found.
- `browser.ts`: IPC handlers for WebContentsView management (Provides communication bridge between renderer process (InAppBrowser component) and main process WebContentsView. Handles navigation, bounds management, state queries, and proxy configuration. This uses the latest Electron API (WebContentsView) replacing deprecated BrowserView and <webview>.)
- `clipboard.ts`: IPC handlers for clipboard operations
- `config.ts`: IPC handlers for user configuration management
- `files.ts`: IPC handlers for file system operations
- `imapFlow.ts`: No description found.
- `index.ts`: Entry point for registering all IPC handlers. It imports handlers from different files and registers them with the main process.
- `proxy.ts`: No description found.

## `src/services/`
- `accountService.ts`: Service for managing account storage and operations.
- `autoDiscoveryService.ts`: Service for auto-discovering email server settings, now with parallel execution and caching.
- `clipboardService.ts`: Service for handling clipboard operations
- `configService.ts`: Service for managing the main application configuration (config.json).
- `connectionManager.ts`: Simple IMAP connection manager
- `domainService.ts`: Service for managing cached email domain configurations (domains.txt).
- `imapFlowService.ts`: No description found.
- `instantImportService.ts`: Instant import service with background DNS discovery Imports accounts immediately and discovers server settings in background
- `logger.ts`: Centralized logger service using Pino. Handles logging to console, file, and renderer process.
- `msalService.ts`: No description found.
- `oauthAccountParser.ts`: Specialized parser for Microsoft OAuth2 account format Handles parsing of format: email:password:refresh_token:client_id with various separators
- `proxyOrchestrator.ts`: Proxy Management Orchestrator (This module centralizes the core business logic for proxy management, decoupling it from React components and hooks. It handles proxy parsing, normalization, validation, and preparation for bulk operations. This service acts as a pure data processing layer, ensuring that UI-independent logic is reusable and easily…
- `proxyService.ts`: Service for managing the proxy list (proxies.txt).
- `proxyTester.ts`: Modern proxy testing service with axios integration (Streamlined proxy testing using axios with http-proxy-agent and socks-proxy-agent. Eliminates custom HTTP request handling for better performance and maintainability. Supports HTTP/HTTPS and SOCKS4/5 proxies with configurable timeout and retry logic. Returns structured results with success…
- `storageManager.ts`: Manages the basic data storage infrastructure (directories and files).
- `tokenManager.ts`: Simple OAuth2 token manager

## `src/services/discovery/`
- `connectionTesting.ts`: Connection testing utilities for email discovery
- `dnsDiscovery.ts`: DNS-based email discovery using modern techniques.
- `exchangeDiscovery.ts`: Microsoft Exchange Autodiscover implementation using modern techniques.
- `providerDiscovery.ts`: Provider-based email discovery
- `types.ts`: Types for email discovery services

## `src/shared/hooks/`
- `useAccountForm.ts`: Hook for managing account form state and logic with improved validation.
- `useAccountInitializer.ts`: Enhanced account initialization hook with race condition prevention (Manages account initialization with duplicate prevention and coordination with useEmailList. Prevents race conditions by tracking active initializations and coordinating with account switching state. Ensures emails are loaded only after successful account initialization to…
- `useAccountManager.ts`: Hook for managing account operations and state
- `useEmailDiscovery.ts`: Hook for email server auto-discovery functionality
- `useEmailList.ts`: Enhanced email list hook with proper email viewing and smart multi-select functionality (Manages email loading with clear separation between viewing and selection: - Coordinates with useAccountInitializer to prevent concurrent IMAP operations - Only loads emails after account switching is completed to ensure proper connection state - selectEmail()…
- `useEmailViewer.ts`: Hook for managing email viewer functionality
- `useMailboxManager.ts`: Hook for managing mailbox functionality
- `useProxyForm.ts`: Proxy Form Management Hook (This hook encapsulates all logic related to the proxy form, including state management with `react-hook-form`, Zod-based validation, and handling of the editing state for updating existing proxies. It provides a clean interface for components to interact with the proxy form without being concerned with the underlying…
- `useProxyManager.ts`: Unified proxy management hook with advanced validation and duplicate handling (Centralized proxy state and operations management with minimal duplication. Strict Zod validation with IP/domain checking, intelligent duplicate prevention, react-hook-form integration. Features: proxy testing, import/export, manual source fetching, localStorage…
- `useProxyStatus.ts`: Hook for managing proxy status functionality
- `useRelativeTime.ts`: No description found.

## `src/shared/store/`
- `imapProviders.ts`: Contains a list of common email provider IMAP settings. This is used for autodetecting server settings when a user adds an account.
- `logStore.ts`: Zustand store for managing a persistent log of application events.
- `mainSettingsStore.ts`: Main application settings store, now synced with the backend. (Store uses immer middleware to simplify nested state updates. All state updates use mutable-looking syntax that Immer converts to immutable updates.)
- `proxyListStore.ts`: Zustand store for managing proxy list state with stable proxy identification. (Single proxy selection only - no rotation. Uses composite key (host:port:username) for stable proxy tracking across operations.)
- `proxyStore.ts`: Zustand store for managing global proxy state (Manages global proxy configuration, status, and settings (randomization, sources, test config, retry settings). Provides persistent storage via zustand/persist middleware. Handles proxy initialization and status updates from main process. Auto-update settings have been removed - proxy fetching is now…
- `uiStore.ts`: No description found.

## `src/shared/store/accounts/`
- `accountStore.ts`: Centralized account state management with enhanced connection status tracking (Zustand store managing email accounts, authentication, and IMAP connections. Features robust reconnection logic, automatic connection status updates, and complete state cleanup for fresh initialization. Handles OAuth2 token expiration and coordinates mailbox/email data…
- `connectionStore.ts`: Focused Zustand store for connection status management
- `emailStore.ts`: Focused Zustand store for email data management
- `index.ts`: Exports for focused account-related stores
- `mailboxStore.ts`: Focused Zustand store for mailbox management

## `src/shared/types/`
- `account.ts`: Account types and schemas for email account management
- `electron.ts`: Electron type definitions for IPC communication
- `email.ts`: Email types for headers and content
- `protocol.ts`: Protocol types for email server configuration and discovery

## `src/shared/ui/`
- `avatar.tsx`: Simple avatar component without Radix UI dependency
- `badge.tsx`: Badge component with variant styling and Radix Slot support for composition (Provides a flexible badge component that supports multiple variants (default, secondary, destructive, outline) for status indicators, labels, and tags. Uses class-variance-authority for variant management and Radix Slot for composition patterns. Implements…
- `button.tsx`: No description found.
- `card.tsx`: No description found.
- `checkbox.tsx`: No description found.
- `dialog.tsx`: No description found.
- `dropdown-menu.tsx`: Dropdown menu component built on top of Radix UI
- `index.ts`: Entry point for UI components
- `input.tsx`: Input component with extended features (Input wrapper with label, error state, floating label support, and copy button functionality. Fully typed for TypeScript.)
- `label.tsx`: No description found.
- `pagination.tsx`: No description found.
- `progress.tsx`: No description found.
- `resizable.tsx`: No description found.
- `scroll-area.tsx`: No description found.
- `select.tsx`: No description found.
- `separator.tsx`: No description found.
- `settings-section.tsx`: Universal settings section component with centered headers (Redesigned section component with centered headers and descriptions. Ensures consistent appearance of all settings sections with icons, titles and content. Automatically adapts to content and supports optional descriptions.)
- `sheet.tsx`: No description found.
- `sidebar.tsx`: No description found.
- `skeleton.tsx`: No description found.
- `sonner.tsx`: No description found.
- `switch.tsx`: No description found.
- `table.tsx`: No description found.
- `tabs.tsx`: No description found.
- `textarea.tsx`: No description found.
- `theme-provider.tsx`: No description found.
- `Toast.tsx`: Toast notification system using Sonner with ShadCN UI integration
- `toggle-group.tsx`: No description found.
- `toggle.tsx`: No description found.
- `tooltip.tsx`: Tooltip component wrapper (Extended Tooltip with simplified API and proper TypeScript types. Supports both standard Radix composition and simplified content prop. Automatically registers in UIStore to hide WebContentsView when open.)
- `top-bar-account-section.tsx`: Account section component for the top bar with ShadCN DropdownMenu
- `top-bar.tsx`: Unified top bar component for consistent application header

## `src/shared/utils/`
- `emailProcessing.ts`: Email processing utilities
- `imapErrorHandling.ts`: IMAP Error Handling and Configuration Utilities
- `logger.ts`: Renderer-side logger proxy. Provides a simple interface for components to send logs to the main process.
- `proxyParser.ts`: Universal proxy content extractor and parser using pure regex. (Zero-dependency, format-agnostic proxy extraction system. Works with ANY content type (HTML, JSON, plain text, XML, binary trash) by using aggressive text preprocessing and regex pattern matching. No platform-specific logic, no URL parsing - just brute-force content extraction.…
- `utils.ts`: Utility functions for ShadCN UI components and general use