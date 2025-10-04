/**
 * @file Proxy Form Management Hook
 * @description This hook encapsulates all logic related to the proxy form,
 *              including state management with `react-hook-form`, Zod-based validation,
 *              and handling of the editing state for updating existing proxies.
 *              It provides a clean interface for components to interact with the proxy
 *              form without being concerned with the underlying implementation details.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { normalizeProxy } from '../../services/proxyOrchestrator'
import { useProxyListStore } from '../store/proxyListStore'
import type { ProxyItem } from '../types/account'
import { logger as appLogger } from '../utils/logger'

// Zod schema for form validation.
const proxyFormSchema = z.object({
  host: z
    .string()
    .min(1, 'Host is required')
    .refine(val => {
      const ipRegex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
      const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
      const localhostRegex = /^localhost$/i

      return ipRegex.test(val) || domainRegex.test(val) || localhostRegex.test(val)
    }, 'Invalid host format. Use IP address, domain name, or localhost'),
  port: z
    .number()
    .min(1, 'Port must be greater than 0')
    .max(65535, 'Port must be less than 65536')
    .int('Port must be a whole number'),
  username: z
    .string()
    .optional()
    .refine(val => {
      if (!val) return true
      return val.length >= 1 && val.length <= 255
    }, 'Username must be between 1 and 255 characters'),
  password: z
    .string()
    .optional()
    .refine(val => {
      if (!val) return true
      return val.length >= 1 && val.length <= 255
    }, 'Password must be between 1 and 255 characters'),
  type: z.enum(['http', 'https', 'socks4', 'socks5']).optional(),
})

export type ProxyFormData = z.infer<typeof proxyFormSchema>

export const useProxyForm = () => {
  const { proxies, addProxy, updateProxy, removeDuplicates } = useProxyListStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const form = useForm<ProxyFormData>({
    resolver: zodResolver(proxyFormSchema),
    defaultValues: {
      host: '',
      port: undefined,
      username: '',
      password: '',
    },
  })

  const { reset, setError, clearErrors } = form

  const handleAddProxy = useCallback(
    (data: ProxyFormData) => {
      const normalized = normalizeProxy(data)

      const isDuplicate = proxies.some(p => {
        const existingNormalized = normalizeProxy(p)
        return (
          existingNormalized.host === normalized.host &&
          existingNormalized.port === normalized.port &&
          (existingNormalized.username || '') === (normalized.username || '') &&
          (existingNormalized.type || 'socks5') === (normalized.type || 'socks5')
        )
      })

      if (isDuplicate) {
        appLogger.error(
          `Proxy ${data.host}:${data.port} with the same type and credentials already exists`
        )
        setError('host', {
          type: 'manual',
          message: 'This proxy configuration already exists',
        })
        return
      }

      addProxy(normalized)
      appLogger.info(`Proxy ${data.host}:${data.port} added successfully`)

      const removedCount = removeDuplicates()
      if (removedCount > 0) {
        appLogger.info(`Removed ${removedCount} duplicate proxy(ies)`)
      }

      clearErrors()
      reset({ host: '', port: undefined, username: '', password: '' })
    },
    [addProxy, clearErrors, proxies, removeDuplicates, reset, setError]
  )

  const handleEditProxy = useCallback(
    (index: number) => {
      const proxy = proxies[index]
      if (proxy) {
        setIsEditing(true)
        setEditingIndex(index)
        reset({
          host: proxy.host,
          port: proxy.port,
          username: proxy.username || '',
          password: proxy.password || '',
          type: proxy.type,
        })
      }
    },
    [proxies, reset]
  )

  const handleUpdateProxy = useCallback(
    (data: ProxyFormData) => {
      if (editingIndex !== null) {
        const normalized = normalizeProxy(data)
        updateProxy(editingIndex, normalized)
        appLogger.info(`Proxy ${data.host}:${data.port} updated`)
        setIsEditing(false)
        setEditingIndex(null)
        reset()
      }
    },
    [editingIndex, updateProxy, reset]
  )

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditingIndex(null)
    reset()
  }, [reset])

  return {
    form,
    isEditing,
    editingIndex,
    setEditingIndex,
    setIsEditing,
    handleAddProxy,
    handleEditProxy,
    handleUpdateProxy,
    handleCancelEdit,
  }
}
