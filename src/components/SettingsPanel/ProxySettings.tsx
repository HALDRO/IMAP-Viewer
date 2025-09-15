/**
 * @file Modern proxy settings component with intuitive interface for all use cases.
 */
import React, { useState } from 'react';

import { useProxyManager } from '../../shared/hooks/useProxyManager';
import { useProxyStatus } from '../../shared/hooks/useProxyStatus';
import { cn } from '../../shared/utils/utils';

import ProxyAddForm from './ProxyAddForm';
import ProxyAdvancedSettings from './ProxyAdvancedSettings';
import ProxyImportPanel from './ProxyImportPanel';
import ProxyList from './ProxyList';
import ProxyStatusHeader from './ProxyStatusHeader';


interface ProxySettingsProps {
  className?: string;
}

/**
 * Main proxy settings component with modular architecture
 */
const ProxySettings: React.FC<ProxySettingsProps> = ({ className }) => {
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [quickProxyType, setQuickProxyType] = useState<'http' | 'https' | 'socks4' | 'socks5'>('socks5');

  const {
    form,
    handleAddProxy,
    handleDeleteProxy,
    handleTestProxy,
    handleTestAllProxies,
    handleImportProxies,
    handleExportProxies,
    enableProxies,
    setEnableProxies,
    randomizeSource,
    setRandomizeSource,
    sourceUrl,
    setSourceUrl,
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    updateInterval,
    setUpdateInterval,
    maxRetries,
    setMaxRetries,
    useRandomProxy,
    setUseRandomProxy,
    isLoading,
    isTesting,
    proxies,
    testResults,
  } = useProxyManager();

  const { error } = useProxyStatus();

  const handleImport = async (): Promise<void> => {
    if (!importText.trim()) return;
    await handleImportProxies(importText);
    setImportText('');
    setShowImport(false);
  };

  const handleExport = (): void => {
    const content = handleExportProxies();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proxies.txt';
    a.click();
    URL.revokeObjectURL(url);
  };



  return (
    <div className={cn("flex flex-col h-full max-w-2xl mx-auto", className)}>
      <ProxyStatusHeader
        enableProxies={enableProxies}
        setEnableProxies={setEnableProxies}
        isLoading={isLoading}
        error={error}
        proxiesCount={proxies.length}
      />

      <ProxyAddForm
        form={form}
        quickProxyType={quickProxyType}
        setQuickProxyType={setQuickProxyType}
        handleAddProxy={handleAddProxy}
      />

      <ProxyAdvancedSettings
        useRandomProxy={useRandomProxy}
        setUseRandomProxy={setUseRandomProxy}
        maxRetries={maxRetries}
        setMaxRetries={setMaxRetries}
        randomizeSource={randomizeSource}
        setRandomizeSource={setRandomizeSource}
        sourceUrl={sourceUrl}
        setSourceUrl={setSourceUrl}
        autoUpdateEnabled={autoUpdateEnabled}
        setAutoUpdateEnabled={setAutoUpdateEnabled}
        updateInterval={updateInterval}
        setUpdateInterval={setUpdateInterval}
        showImport={showImport}
        setShowImport={setShowImport}
        handleTestAllProxies={handleTestAllProxies}
        handleExport={handleExport}
        isLoading={isLoading}
        proxiesCount={proxies.length}
      />

      <ProxyImportPanel
        showImport={showImport}
        importText={importText}
        setImportText={setImportText}
        setShowImport={setShowImport}
        handleImport={handleImport}
      />

      <ProxyList
        proxies={proxies}
        testResults={testResults}
        isTesting={isTesting}
        handleTestProxy={handleTestProxy}
        handleDeleteProxy={handleDeleteProxy}
      />

    </div>
  );
};

export default ProxySettings;
