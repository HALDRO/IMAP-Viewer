/**
 * @file Modern proxy settings component with intuitive interface for all use cases
 * @description Main proxy settings component orchestrating proxy configuration, testing, import/export, and list management. Coordinates between useProxyManager, useProxyForm, and useProxyStatus hooks. Provides UI for manual proxy operations - adding, testing, fetching from sources, and managing proxy list. Auto-update functionality has been removed per user requirements.
 */
import type React from 'react'
import { useState } from 'react'

import { useProxyForm } from '../../shared/hooks/useProxyForm'
import { useProxyManager } from '../../shared/hooks/useProxyManager'
import { useProxyStatus } from '../../shared/hooks/useProxyStatus'
import { cn } from '../../shared/utils/utils'

import { ProxyConfiguration } from './ProxyComponents'
import ProxyList from './ProxyList'

interface ProxySettingsProps {
  className?: string
}

/**
 * Main proxy settings component with modular architecture
 */
const ProxySettings: React.FC<ProxySettingsProps> = ({ className }) => {
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  const {
    handleSetProxy,
    handleTestProxy,
    handleTestAllProxies,
    handleDeleteInvalidProxies,
    handleImportProxies,
    handleExportProxies,
    handleFetchFromExternalSource,
    enableProxies,
    randomizeSource,
    setRandomizeSource,
    proxySources,
    setProxySources,
    maxRetries,
    setMaxRetries,
    testTimeout,
    setTestTimeout,
    testUrl,
    setTestUrl,
    delayBetweenRetries,
    setDelayBetweenRetries,
    defaultProxyType,
    setDefaultProxyType,
    selectedProxyIndex,
    setSelectedProxyIndex,
    isLoading,
    isTesting,
    isTestingAll,
    testProgress,
    proxies,
    testResults,
    clearAllProxies,
    handleStopTestAll,
    deleteProxy,
  } = useProxyManager()

  const { form, handleAddProxy } = useProxyForm()

  const { error } = useProxyStatus()

  const handleImport = async (): Promise<void> => {
    if (!importText.trim()) return
    await handleImportProxies(importText)
    setImportText('')
    setShowImport(false)
  }

  const handleExport = (): void => {
    const content = handleExportProxies()
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'proxies.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={cn('flex flex-col gap-3 h-full w-full', className)}>
      {/* Proxy Configuration Block */}
      <ProxyConfiguration
        form={form}
        quickProxyType={defaultProxyType}
        setQuickProxyType={setDefaultProxyType}
        handleAddProxy={async () => {
          const isValid = await form.trigger()
          if (isValid) {
            handleAddProxy({ ...form.getValues(), type: defaultProxyType })
          }
        }}
        maxRetries={maxRetries}
        setMaxRetries={setMaxRetries}
        testTimeout={testTimeout}
        setTestTimeout={setTestTimeout}
        testUrl={testUrl}
        setTestUrl={setTestUrl}
        delayBetweenRetries={delayBetweenRetries}
        setDelayBetweenRetries={setDelayBetweenRetries}
        randomizeSource={randomizeSource}
        setRandomizeSource={setRandomizeSource}
        proxySources={proxySources}
        setProxySources={setProxySources}
        enableProxies={enableProxies}
        handleSetProxy={handleSetProxy}
        selectedProxyIndex={selectedProxyIndex}
        showImport={showImport}
        setShowImport={setShowImport}
        importText={importText}
        setImportText={setImportText}
        handleImport={() => {
          void handleImport()
        }}
        isLoading={isLoading}
        error={error}
        proxiesCount={proxies.length}
        onFetchFromSource={async () => {
          await handleFetchFromExternalSource()
        }}
      />

      {/* Proxy Management Block */}
      <ProxyList
        proxies={proxies}
        testResults={testResults}
        isTesting={isTesting}
        isTestingAll={isTestingAll}
        selectedProxyIndex={selectedProxyIndex}
        handleTestProxy={handleTestProxy}
        handleDeleteProxy={deleteProxy}
        handleSelectProxy={setSelectedProxyIndex}
        showImport={showImport}
        setShowImport={setShowImport}
        handleTestAllProxies={async () => {
          await handleTestAllProxies()
        }}
        handleStopTestAll={handleStopTestAll}
        handleDeleteInvalidProxies={async () => {
          await handleDeleteInvalidProxies()
        }}
        handleExport={handleExport}
        clearAllProxies={clearAllProxies}
        isLoading={isLoading}
        testProgress={testProgress}
      />
    </div>
  )
}

export default ProxySettings
