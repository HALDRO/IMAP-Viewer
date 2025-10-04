/**
 * @file Hook for managing proxy status functionality
 */
import { AlertTriangle, Loader, Power, PowerOff } from 'lucide-react'
import type { ComponentType } from 'react'

import { useProxyStore } from '../store/proxyStore'
import type { ProxyConfig } from '../types/account'
import type { ProxyStatus } from '../types/electron'

interface UseProxyStatusReturn {
  // Status data
  status: string
  error: string | null
  externalIp: string | null
  config: unknown

  // UI data
  statusInfo: {
    Icon: React.ComponentType<{ size?: number; className?: string }>
    color: string
    baseLabel: string
  }
  label: string
  tooltip: string
  textColor: string

  // Actions
  handleRefresh: () => void
}

/**
 * Hook for managing proxy status functionality
 */
export const useProxyStatus = (): UseProxyStatusReturn => {
  const status = useProxyStore(state => state.status)
  const error = useProxyStore(state => state.error)
  const externalIp = useProxyStore(state => state.externalIp)
  const config = useProxyStore(state => state.config)

  const handleRefresh = (): void => {
    if (status !== 'connecting' && config?.enabled === true) {
      void window.ipcApi.proxy.setGlobal(config)
    }
  }

  const getStatusInfo = (
    currentStatus: ProxyStatus
  ): { Icon: ComponentType<Record<string, unknown>>; color: string; baseLabel: string } => {
    switch (currentStatus) {
      case 'disabled':
        return { Icon: PowerOff, color: 'text-muted-foreground', baseLabel: 'Proxy Off' }
      case 'enabled':
        return { Icon: Power, color: 'text-primary', baseLabel: 'Proxy On' }
      case 'connecting':
        return { Icon: Loader, color: 'text-yellow-500', baseLabel: 'Connecting' }
      case 'connected':
        return { Icon: Power, color: 'text-green-500', baseLabel: 'Connected' }
      case 'error':
        return { Icon: AlertTriangle, color: 'text-destructive', baseLabel: 'Error' }
      default:
        return { Icon: AlertTriangle, color: 'text-destructive', baseLabel: 'Unknown' }
    }
  }

  const statusInfo = getStatusInfo(status)

  const label = ((): string => {
    const baseLabel = statusInfo.baseLabel
    if (
      status === 'connected' &&
      externalIp !== null &&
      externalIp !== undefined &&
      externalIp.length > 0
    ) {
      return `${baseLabel}: ${externalIp}`
    }
    if (
      status === 'enabled' &&
      config &&
      (config as ProxyConfig)?.hostPort &&
      typeof (config as ProxyConfig).hostPort === 'string' &&
      (config as ProxyConfig & { hostPort: string }).hostPort.length > 0
    ) {
      return `${baseLabel}: ${(config as ProxyConfig).hostPort}`
    }
    return baseLabel
  })()

  const tooltip =
    error !== null && error !== undefined && error.length > 0
      ? `${statusInfo.baseLabel}: ${error}`
      : label
  const textColor = statusInfo.color.split(' ')[0] // Use the base color for text

  return {
    status,
    error,
    externalIp,
    config,
    statusInfo,
    label,
    tooltip,
    textColor,
    handleRefresh,
  }
}
