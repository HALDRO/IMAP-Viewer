/**
 * @file Unified file of all proxy configuration components with complete unification
 * @description Combined components for proxy configuration: status header, add form, advanced settings (randomization, manual source fetching), test settings, import panel. Eliminates code duplication and provides centralized architecture for all proxy components in one place. Auto-update UI has been removed - users manually fetch proxies via "Get" button when needed.
 */
import { Globe, Info, Plus, Settings, Settings2, Wifi } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { ProxyFormData } from '../../shared/hooks/useProxyForm'
import { Button } from '../../shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Input } from '../../shared/ui/input'
import { Label } from '../../shared/ui/label'
import { Switch } from '../../shared/ui/switch'
import { Textarea } from '../../shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '../../shared/ui/toggle-group'
import { Tooltip } from '../../shared/ui/tooltip'
import { cn } from '../../shared/utils/utils'

// ====================================
// INTERFACES
// ====================================

interface ProxyStatusHeaderProps {
  enableProxies: boolean
  handleSetProxy: (index: number | null) => Promise<void>
  selectedProxyIndex: number | null
  isLoading: boolean
  error: string | null
  proxiesCount: number
}

interface ProxyAddFormProps {
  form: UseFormReturn<ProxyFormData>
  quickProxyType: 'http' | 'https' | 'socks4' | 'socks5'
  setQuickProxyType: (_type: 'http' | 'https' | 'socks4' | 'socks5') => void
  handleAddProxy: (_data: ProxyFormData & { type?: 'http' | 'https' | 'socks4' | 'socks5' }) => void
}

interface ProxyAdvancedSettingsProps {
  randomizeSource: boolean
  setRandomizeSource: (_value: boolean) => void
  proxySources: string[]
  setProxySources: (_sources: string[]) => void
  onFetchFromSource?: (url?: string) => void
}

interface ProxyImportPanelProps {
  showImport: boolean
  importText: string
  setImportText: (text: string) => void
  setShowImport: (show: boolean) => void
  handleImport: () => void
}

interface ProxyTesterCardProps {
  maxRetries: number
  setMaxRetries: (value: number) => void
  testTimeout: number
  setTestTimeout: (value: number) => void
  testUrl: string
  setTestUrl: (value: string) => void
  delayBetweenRetries: number
  setDelayBetweenRetries: (value: number) => void
}

interface ProxyConfigurationProps {
  form: UseFormReturn<ProxyFormData>
  quickProxyType: 'http' | 'https' | 'socks4' | 'socks5'
  setQuickProxyType: (type: 'http' | 'https' | 'socks4' | 'socks5') => void
  handleAddProxy: () => Promise<void>
  maxRetries: number
  setMaxRetries: (value: number) => void
  testTimeout: number
  setTestTimeout: (value: number) => void
  testUrl: string
  setTestUrl: (value: string) => void
  delayBetweenRetries: number
  setDelayBetweenRetries: (value: number) => void
  randomizeSource: boolean
  setRandomizeSource: (value: boolean) => void
  proxySources: string[]
  setProxySources: (sources: string[]) => void
  enableProxies: boolean
  handleSetProxy: (index: number | null) => Promise<void>
  selectedProxyIndex: number | null
  isLoading: boolean
  error: string | null
  proxiesCount: number
  onFetchFromSource?: () => void
  showImport: boolean
  setShowImport: (value: boolean) => void
  importText: string
  setImportText: (value: string) => void
  handleImport: () => void
}

// ====================================
// PROXY STATUS HEADER
// ====================================

/**
 * Header component showing proxy status and controls
 */
export const ProxyStatusHeader: React.FC<ProxyStatusHeaderProps> = ({
  enableProxies,
  handleSetProxy,
  selectedProxyIndex,
  isLoading,
  error,
  proxiesCount,
}) => {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mb-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={cn('w-2 h-2 rounded-full', enableProxies ? 'bg-green-500' : 'bg-gray-500')}
          />
          <Button
            type="button"
            onClick={() => {
              void (async (): Promise<void> => {
                try {
                  if (enableProxies) {
                    await handleSetProxy(null)
                  } else {
                    await handleSetProxy(selectedProxyIndex ?? 0)
                  }
                } catch (toggleError) {
                  // Log error for debugging
                  console.error('Failed to toggle proxy:', toggleError)
                }
              })()
            }}
            variant={enableProxies ? 'default' : 'outline'}
            size="sm"
            className="gap-2 h-8 px-4"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : enableProxies ? 'Enabled' : 'Disabled'}
          </Button>
          {(error?.length ?? 0) > 0 && <span className="text-xs text-red-500 ml-1">({error})</span>}
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe size={14} />
          <span>
            {proxiesCount} {proxiesCount === 1 ? 'proxy' : 'proxies'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ====================================
// PROXY ADD FORM COMPONENTS
// ====================================

/**
 * Proxy type selection component
 */
const ProxyTypeSelector: React.FC<{
  quickProxyType: 'http' | 'https' | 'socks4' | 'socks5'
  setQuickProxyType: (type: 'http' | 'https' | 'socks4' | 'socks5') => void
}> = ({ quickProxyType, setQuickProxyType }) => (
  <div className="flex-1">
    <ToggleGroup
      type="single"
      value={quickProxyType}
      onValueChange={value => {
        if (value && ['http', 'https', 'socks4', 'socks5'].includes(value)) {
          setQuickProxyType(value as 'http' | 'https' | 'socks4' | 'socks5')
        }
      }}
      className="justify-start"
    >
      <ToggleGroupItem value="socks5" variant="outline" size="default" className="px-4 h-9">
        SOCKS5
      </ToggleGroupItem>
      <ToggleGroupItem value="socks4" variant="outline" size="default" className="px-4 h-9">
        SOCKS4
      </ToggleGroupItem>
      <ToggleGroupItem value="http" variant="outline" size="default" className="px-4 h-9">
        HTTP
      </ToggleGroupItem>
      <ToggleGroupItem value="https" variant="outline" size="default" className="px-4 h-9">
        HTTPS
      </ToggleGroupItem>
    </ToggleGroup>
  </div>
)

/**
 * Add proxy button component
 */
const AddProxyButton: React.FC<{
  form: UseFormReturn<ProxyFormData>
  quickProxyType: 'http' | 'https' | 'socks4' | 'socks5'
  handleAddProxy: (data: ProxyFormData & { type?: 'http' | 'https' | 'socks4' | 'socks5' }) => void
}> = ({ form, quickProxyType, handleAddProxy }) => {
  const handleClick = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()

    const isValid = await form.trigger()
    if (isValid) {
      const data = form.getValues()
      handleAddProxy({ ...data, type: quickProxyType })
    }
  }

  return (
    <Tooltip content="Add new proxy with current settings">
      <Button
        type="button"
        onClick={e => void handleClick(e)}
        size="sm"
        className="h-9 px-4 gap-2 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg"
      >
        <Plus size={16} />
        Add Proxy
      </Button>
    </Tooltip>
  )
}

/**
 * Host and port input fields
 */
const HostPortInputs: React.FC<{
  form: UseFormReturn<ProxyFormData>
}> = ({ form }) => {
  const {
    formState: { errors },
  } = form

  return (
    <div className="grid grid-cols-2 gap-3">
      <Input
        id="quick-host"
        label="Host (example.com)"
        floatingLabel
        labelBackground="var(--color-card)"
        error={errors.host?.message}
        placeholder=" "
        className="placeholder:text-muted-foreground/60"
        {...form.register('host')}
      />
      <Input
        id="quick-port"
        type="number"
        label="Port (8080)"
        floatingLabel
        labelBackground="var(--color-card)"
        error={errors.port?.message}
        placeholder=" "
        className="placeholder:text-muted-foreground/60"
        min="1"
        max="65535"
        {...form.register('port', { valueAsNumber: true })}
      />
    </div>
  )
}

/**
 * Username and password input fields
 */
const AuthInputs: React.FC<{
  form: UseFormReturn<ProxyFormData>
}> = ({ form }) => {
  const {
    formState: { errors },
  } = form

  return (
    <div className="grid grid-cols-2 gap-3">
      <Input
        id="quick-username"
        label="Username (Optional)"
        floatingLabel
        labelBackground="var(--color-card)"
        error={errors.username?.message}
        placeholder=" "
        hideCopyButton
        {...form.register('username')}
      />
      <Input
        id="quick-password"
        type="password"
        label="Password (Optional)"
        floatingLabel
        labelBackground="var(--color-card)"
        error={errors.password?.message}
        placeholder=" "
        hideCopyButton
        {...form.register('password')}
      />
    </div>
  )
}

/**
 * Form component for adding new proxies
 */
export const ProxyAddForm: React.FC<ProxyAddFormProps> = ({
  form,
  quickProxyType,
  setQuickProxyType,
  handleAddProxy,
}) => {
  return (
    <div className="space-y-4">
      {/* First Row: Type Selection + Add Button */}
      <div className="flex items-end justify-between gap-4">
        <ProxyTypeSelector quickProxyType={quickProxyType} setQuickProxyType={setQuickProxyType} />
        <AddProxyButton
          form={form}
          quickProxyType={quickProxyType}
          handleAddProxy={handleAddProxy}
        />
      </div>

      {/* Second Row: Host and Port */}
      <HostPortInputs form={form} />

      {/* Third Row: Username and Password */}
      <AuthInputs form={form} />
    </div>
  )
}

// ====================================
// PROXY ADVANCED SETTINGS
// ====================================

/**
 * Proxy Sources Input
 */
export const ProxySourcesInput: React.FC<{
  proxySources: string[]
  setProxySources: (sources: string[]) => void
  isExpanded: boolean
  onToggle: () => void
}> = ({ proxySources, setProxySources, isExpanded }) => {
  const [text, setText] = useState(() => proxySources.join('\n'))

  return (
    <div className="space-y-2">
      {isExpanded && (
        <>
          <Textarea
            id="proxy-sources"
            value={text}
            onChange={e => {
              setText(e.target.value)
              const lines = e.target.value
                .split('\n')
                .map(l => l.trim())
                .filter(Boolean)
              setProxySources(lines)
            }}
            placeholder="Example sources:&#10;https://example.com/proxies1.txt&#10;https://example.com/proxies2.txt&#10;https://example.com/proxies3.txt"
            className="min-h-32 resize-none font-mono text-xs"
            rows={6}
          />
          <p className="text-xs text-muted-foreground">
            {proxySources.length} source{proxySources.length !== 1 ? 's' : ''} configured
          </p>
        </>
      )}
    </div>
  )
}

/**
 * Source management section
 */
const SourceManagement: React.FC<{
  randomizeSource: boolean
  setRandomizeSource: (value: boolean) => void
  proxySources: string[]
  setProxySources: (sources: string[]) => void
  onFetchFromSource?: (url?: string) => void
}> = ({
  randomizeSource,
  setRandomizeSource,
  proxySources,
  setProxySources,
  onFetchFromSource,
}) => {
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false)

  return (
    <div className="space-y-4">
      {/* Always render the proxy source section, even if no sources are configured */}
      <div className="flex items-center justify-between h-8">
        <div className="flex items-center gap-2">
          <Tooltip content="Randomize proxy list order when fetching from sources">
            <Settings2 size={14} className="text-muted-foreground cursor-help" />
          </Tooltip>
          <Label htmlFor="randomize-source" className="text-sm">
            Randomize Order
          </Label>
        </div>
        <Switch
          id="randomize-source"
          checked={randomizeSource}
          onCheckedChange={setRandomizeSource}
        />
      </div>

      <div className="flex items-center justify-between h-8">
        <div className="flex items-center gap-2">
          <Tooltip content="Configure proxy source URLs">
            <Globe size={14} className="text-muted-foreground cursor-help" />
          </Tooltip>
          <Label className="text-sm">Proxy Source</Label>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
            className="px-2 h-8 text-xs"
          >
            {isSourcesExpanded ? 'Collapse' : 'Expand'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void onFetchFromSource?.()
            }}
            className="px-3 h-8 text-xs"
          >
            Get
          </Button>
        </div>
      </div>

      <ProxySourcesInput
        proxySources={proxySources}
        setProxySources={setProxySources}
        isExpanded={isSourcesExpanded}
        onToggle={() => setIsSourcesExpanded(!isSourcesExpanded)}
      />
    </div>
  )
}

/**
 * Advanced settings component for proxy configuration
 */
export const ProxyAdvancedSettings: React.FC<ProxyAdvancedSettingsProps> = ({
  randomizeSource,
  setRandomizeSource,
  proxySources,
  setProxySources,
  onFetchFromSource,
}) => {
  return (
    <div className="space-y-1">
      {/* Source Management */}
      <SourceManagement
        randomizeSource={randomizeSource}
        setRandomizeSource={setRandomizeSource}
        proxySources={proxySources}
        setProxySources={setProxySources}
        onFetchFromSource={onFetchFromSource}
      />
    </div>
  )
}

// ====================================
// PROXY TESTER CARD
// ====================================

/**
 * Test settings section
 */
const TestSettings: React.FC<{
  maxRetries: number
  setMaxRetries: (value: number) => void
  testTimeout: number
  setTestTimeout: (value: number) => void
  delayBetweenRetries: number
  setDelayBetweenRetries: (value: number) => void
}> = ({
  maxRetries,
  setMaxRetries,
  testTimeout,
  setTestTimeout,
  delayBetweenRetries,
  setDelayBetweenRetries,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between h-8">
      <div className="flex items-center gap-2">
        <Tooltip content="Number of retry attempts before giving up (1-10)">
          <Settings2 size={14} className="text-muted-foreground cursor-help" />
        </Tooltip>
        <Label htmlFor="max-retries" className="text-sm">
          Max Retries
        </Label>
      </div>
      <div className="flex items-center -gap-1">
        <input
          id="max-retries"
          type="range"
          min={1}
          max={10}
          step={1}
          value={maxRetries}
          onChange={e => setMaxRetries(Number.parseInt(e.target.value))}
          className="w-26 h-5 bg-muted rounded-l-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-track]:bg-muted [&::-webkit-slider-track]:h-5 [&::-webkit-slider-track]:rounded-l-full"
        />
        <div className="flex items-center justify-center w-12 h-5 text-xs font-medium bg-muted rounded-r-full border-l border-muted-foreground/20">
          {maxRetries}
        </div>
      </div>
    </div>

    <div className="flex items-center justify-between h-8">
      <div className="flex items-center gap-2">
        <Tooltip content="Timeout for each test attempt in milliseconds (1000-10000)">
          <Info size={14} className="text-muted-foreground cursor-help" />
        </Tooltip>
        <Label htmlFor="test-timeout" className="text-sm">
          Test Timeout (ms)
        </Label>
      </div>
      <div className="flex items-center -gap-1">
        <input
          id="test-timeout"
          type="range"
          min={1000}
          max={10000}
          step={500}
          value={testTimeout}
          onChange={e => setTestTimeout(Number.parseInt(e.target.value))}
          className="w-26 h-5 bg-muted rounded-l-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-track]:bg-muted [&::-webkit-slider-track]:h-5 [&::-webkit-slider-track]:rounded-l-full"
        />
        <div className="flex items-center justify-center w-12 h-5 text-xs font-medium bg-muted rounded-r-full border-l border-muted-foreground/20">
          {testTimeout}
        </div>
      </div>
    </div>

    <div className="flex items-center justify-between h-8">
      <div className="flex items-center gap-2">
        <Tooltip content="Delay between retry attempts in milliseconds (0-5000)">
          <Settings2 size={14} className="text-muted-foreground cursor-help" />
        </Tooltip>
        <Label htmlFor="delay-retries" className="text-sm">
          Retry Delay (ms)
        </Label>
      </div>
      <div className="flex items-center -gap-1">
        <input
          id="delay-retries"
          type="range"
          min={0}
          max={5000}
          step={100}
          value={delayBetweenRetries}
          onChange={e => setDelayBetweenRetries(Number.parseInt(e.target.value))}
          className="w-26 h-5 bg-muted rounded-l-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-track]:bg-muted [&::-webkit-slider-track]:h-5 [&::-webkit-slider-track]:rounded-l-full"
        />
        <div className="flex items-center justify-center w-12 h-5 text-xs font-medium bg-muted rounded-r-full border-l border-muted-foreground/20">
          {delayBetweenRetries}
        </div>
      </div>
    </div>
  </div>
)

/**
 * Test URL settings section
 */
const TestUrlSettings: React.FC<{
  testUrl: string
  setTestUrl: (value: string) => void
}> = ({ testUrl, setTestUrl }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between h-8">
      <div className="flex items-center gap-2">
        <Tooltip content="URL used for testing proxy connectivity">
          <Globe size={14} className="text-muted-foreground cursor-help" />
        </Tooltip>
        <Label htmlFor="test-url" className="text-sm">
          Test URL
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Input
          id="test-url"
          type="url"
          value={testUrl}
          onChange={e => setTestUrl(e.target.value)}
          placeholder="https://httpbin.org/ip"
          className="w-48 placeholder:text-muted-foreground/60"
        />
      </div>
    </div>
  </div>
)

/**
 * Proxy Tester section component (without card wrapper)
 */
export const ProxyTesterSection: React.FC<ProxyTesterCardProps> = ({
  maxRetries,
  setMaxRetries,
  testTimeout,
  setTestTimeout,
  testUrl,
  setTestUrl,
  delayBetweenRetries,
  setDelayBetweenRetries,
}) => {
  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <div className="flex items-center gap-2">
        <Wifi size={16} className="text-purple-500" />
        <h5 className="text-sm font-semibold text-foreground">Proxy Tester</h5>
      </div>

      <div className="space-y-1">
        <TestSettings
          maxRetries={maxRetries}
          setMaxRetries={setMaxRetries}
          testTimeout={testTimeout}
          setTestTimeout={setTestTimeout}
          delayBetweenRetries={delayBetweenRetries}
          setDelayBetweenRetries={setDelayBetweenRetries}
        />

        <TestUrlSettings testUrl={testUrl} setTestUrl={setTestUrl} />
      </div>
    </div>
  )
}

// ====================================
// PROXY IMPORT PANEL
// ====================================

/**
 * Panel component for importing proxy lists
 */
export const ProxyImportPanel: React.FC<ProxyImportPanelProps> = ({
  showImport,
  importText,
  setImportText,
  setShowImport,
  handleImport,
}) => {
  if (!showImport) {
    return null
  }

  return (
    <Card className="mb-4 border-0 shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">Import Proxies</h4>
          <span className="text-xs text-muted-foreground">
            {importText.split('\n').filter(line => line.trim() && !line.startsWith('#')).length}{' '}
            proxies detected
          </span>
        </div>
        <textarea
          className="w-full min-h-20 px-3 py-2 text-sm rounded border border-input bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          placeholder="type:host:port:username:password (one per line)&#10;socks5:192.168.1.1:1080:user:pass&#10;http:proxy.example.com:8080::"
          value={importText}
          onChange={e => setImportText(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowImport(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void handleImport()
            }}
            disabled={!importText.trim()}
          >
            Import
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ====================================
// MAIN PROXY CONFIGURATION COMPONENT
// ====================================

/**
 * Main proxy configuration component with all functionality
 */
export const ProxyConfiguration: React.FC<ProxyConfigurationProps> = ({
  form,
  quickProxyType,
  setQuickProxyType,
  handleAddProxy,
  maxRetries,
  setMaxRetries,
  testTimeout,
  setTestTimeout,
  testUrl,
  setTestUrl,
  delayBetweenRetries,
  setDelayBetweenRetries,
  randomizeSource,
  setRandomizeSource,
  proxySources,
  setProxySources,
  enableProxies,
  handleSetProxy,
  selectedProxyIndex,
  error,
  onFetchFromSource,
  showImport,
  setShowImport,
  importText,
  setImportText,
  handleImport,
}) => {
  return (
    <Card className="border-border bg-card shadow-lg">
      <CardContent className="p-0 h-full">
        <div className="h-full overflow-hidden">
          <div className="px-3 md:px-4 lg:px-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-medium flex items-center gap-2">
                <Settings size={20} className="text-purple-500" />
                <span className="bg-linear-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent font-semibold">
                  Proxy Configuration
                </span>
              </h4>
              <div className="flex items-center gap-3">
                <Label htmlFor="enable-proxies" className="text-sm font-medium">
                  Enable Proxies
                </Label>
                <Switch
                  id="enable-proxies"
                  checked={enableProxies}
                  onCheckedChange={async checked => {
                    if (checked) {
                      await handleSetProxy(selectedProxyIndex ?? 0)
                    } else {
                      await handleSetProxy(null)
                    }
                  }}
                />
              </div>
            </div>
            {(error?.length ?? 0) > 0 && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mb-3">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {/* Add Proxy Form */}
              <ProxyAddForm
                form={form}
                quickProxyType={quickProxyType}
                setQuickProxyType={setQuickProxyType}
                handleAddProxy={_data => {
                  void handleAddProxy()
                }}
              />

              {/* Advanced Settings */}
              <ProxyAdvancedSettings
                randomizeSource={randomizeSource}
                setRandomizeSource={setRandomizeSource}
                proxySources={proxySources}
                setProxySources={setProxySources}
                onFetchFromSource={onFetchFromSource}
              />

              {/* Proxy Tester Settings */}
              <ProxyTesterSection
                maxRetries={maxRetries}
                setMaxRetries={setMaxRetries}
                testTimeout={testTimeout}
                setTestTimeout={setTestTimeout}
                testUrl={testUrl}
                setTestUrl={setTestUrl}
                delayBetweenRetries={delayBetweenRetries}
                setDelayBetweenRetries={setDelayBetweenRetries}
              />

              {/* Import Panel */}
              <ProxyImportPanel
                showImport={showImport}
                importText={importText}
                setImportText={setImportText}
                setShowImport={setShowImport}
                handleImport={handleImport}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ProxyConfiguration
