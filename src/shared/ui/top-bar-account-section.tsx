/**
 * @file Account section component for the top bar with ShadCN DropdownMenu
 */
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import React from 'react'

import { cn } from '../utils/utils'

import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'

interface TopBarAccountSectionProps {
  accountCount: number
  isCollapsed: boolean
  isConnectingAll: boolean
  isSettingsOpen?: boolean
  onSettings: () => void
  onToggleCollapse: () => void // Now toggleSidebar
  onConnectAll: () => void
  onDataFiles: () => void
  onImportAccounts: () => void
  onDeleteAllAccounts: () => void
}

/**
 * Account section for the top bar showing account count and actions
 */
export const TopBarAccountSection: React.FC<TopBarAccountSectionProps> = React.memo(
  ({
    accountCount,
    isCollapsed,
    isConnectingAll,
    isSettingsOpen = false,
    onSettings,
    onToggleCollapse,
    onConnectAll,
    onDataFiles,
    onImportAccounts,
    onDeleteAllAccounts,
  }) => {
    return (
      <div className="flex items-center gap-1">
        {/* Account Management Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground h-8 px-2 pr-4"
            >
              <Users className="text-primary" style={{ width: '20px', height: '20px' }} />
              <span className="font-medium">{accountCount}</span>
              <span>{accountCount === 1 ? 'Account' : 'Accounts'}</span>
              <ChevronDown size={14} className="opacity-50" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={onImportAccounts}>
              <Upload className="mr-2 h-4 w-4" />
              Import Accounts
            </DropdownMenuItem>

            <DropdownMenuItem onClick={onConnectAll} disabled={isConnectingAll}>
              <RefreshCw className={cn('mr-2 h-4 w-4', isConnectingAll && 'animate-spin')} />
              {isConnectingAll ? 'Connecting...' : 'Connect All Accounts'}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={onDeleteAllAccounts} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete All Accounts
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={onDataFiles}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Open Data Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings Button */}
        <Button
          variant={isSettingsOpen ? 'default' : 'ghost'}
          size="icon"
          onClick={onSettings}
          className="h-8 w-8 rounded-full"
          title="Settings"
        >
          <Settings size={16} />
        </Button>

        {/* Collapse/Expand Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8 rounded-full"
          title={isCollapsed ? 'Expand account panel' : 'Collapse account panel'}
        >
          {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </Button>
      </div>
    )
  }
)

TopBarAccountSection.displayName = 'TopBarAccountSection'
