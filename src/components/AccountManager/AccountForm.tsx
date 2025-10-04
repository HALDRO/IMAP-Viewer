/**
 * @file Refactored account form component for a better user experience.
 */

import { AlertCircle, ArrowLeft, RefreshCw, Save } from 'lucide-react'
import type React from 'react'
import { useEffect } from 'react'
import { Controller } from 'react-hook-form'

import { useAccountForm } from '../../shared/hooks/useAccountForm'
import { imapProviders } from '../../shared/store/imapProviders'
import type { Account } from '../../shared/types/account'
import { Button } from '../../shared/ui/button'
import { Input } from '../../shared/ui/input'
import { Label } from '../../shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shared/ui/select'
import { ToggleGroup, ToggleGroupItem } from '../../shared/ui/toggle-group'
import { cn } from '../../shared/utils/utils'

// ... (interface definition remains the same)
interface AccountFormProps {
  accountToEdit?: Account | null
  onCancel: () => void
  onSuccess: (_data: Omit<Account, 'id'>) => Promise<void>
  initialData?: {
    email: string
    password: string
  } | null
}

const AccountForm: React.FC<AccountFormProps> = ({
  accountToEdit,
  onCancel,
  onSuccess,
  initialData,
}) => {
  const {
    form,
    error,
    showProviderSuggestions,
    setShowProviderSuggestions,
    discovery,
    handleProviderSelect,
    handleManualDiscovery,
    handleEmailBlur,
    handleSubmit,
  } = useAccountForm({ accountToEdit, initialData, onSave: onSuccess })

  const {
    register,
    formState: { errors, isSubmitting },
    control,
    watch,
    setValue,
  } = form
  const watchedEmail = watch('email')

  useEffect(() => {
    if (discovery.discoveryStatus === 'failed') {
      setShowProviderSuggestions(true)
    } else {
      setShowProviderSuggestions(false)
    }
  }, [discovery.discoveryStatus, setShowProviderSuggestions])

  // Auto-select OAuth2 tab for Microsoft accounts when editing
  useEffect(() => {
    if (accountToEdit && (accountToEdit.clientId || accountToEdit.refreshToken)) {
      setValue('authType', 'oauth2')
    }
  }, [accountToEdit, setValue])

  return (
    <div className="h-full flex flex-col bg-background text-foreground w-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 border-b border-border shrink-0 h-12">
        <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-full">
          <ArrowLeft size={20} />
        </Button>
        <h2 className="text-xl font-semibold truncate">
          {accountToEdit ? 'Edit Account' : 'Add New Account'}
        </h2>
      </div>

      {/* Form */}
      <div className="grow overflow-y-auto p-4">
        <form
          onSubmit={e => {
            void handleSubmit(e)
          }}
          className="space-y-6"
        >
          {/* Credentials */}
          <div className="space-y-4">
            {/* Email Field */}
            <Input
              {...register('email')}
              type="email"
              label="Email Address *"
              error={errors.email?.message}
              floatingLabel
              labelBackground="rgb(20, 19, 22)"
              onBlur={e => {
                void handleEmailBlur(e)
              }}
            />

            {/* Password Field */}
            <Input
              {...register('password')}
              type="password"
              label={`Password ${watch('authType') !== 'oauth2' ? '*' : ''}`}
              error={errors.password?.message}
              floatingLabel
              labelBackground="rgb(20, 19, 22)"
            />

            {/* OAuth2 Fields - shown only when OAuth2 protocol is selected */}
            {watch('incoming.protocol') === 'oauth2' && (
              <>
                <Input
                  {...register('clientId')}
                  type="text"
                  label="Client ID *"
                  error={errors.clientId?.message}
                  floatingLabel
                  labelBackground="rgb(20, 19, 22)"
                />

                <Input
                  {...register('refreshToken')}
                  type="text"
                  label="Refresh Token *"
                  error={errors.refreshToken?.message}
                  floatingLabel
                  labelBackground="rgb(20, 19, 22)"
                />
              </>
            )}
          </div>

          {/* Discovery Status & Manual Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-medium truncate">Server</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleManualDiscovery()
                }}
                disabled={discovery.isDiscovering || !watchedEmail}
                className="shrink-0"
              >
                <RefreshCw size={14} className={cn(discovery.isDiscovering && 'animate-spin')} />
                <span className="ml-1.5">Auto</span>
              </Button>
            </div>

            {discovery.isDiscovering && (
              <div className="space-y-2">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-gray-600">Discovering settings...</span>
                  <span className="text-xs text-gray-500">May take up to 60 sec</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full animate-pulse"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}

            {discovery.discoveryStatus === 'failed' && (
              <div className="p-2.5 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
                <p className="text-sm">{discovery.discoveryMessage}</p>
                <p className="text-xs mt-1">Select provider or enter manually</p>
              </div>
            )}

            {showProviderSuggestions && (
              <Select
                onValueChange={name => {
                  const provider = imapProviders.find(p => p.name === name)
                  if (provider) {
                    handleProviderSelect(provider.config)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a common provider..." />
                </SelectTrigger>
                <SelectContent>
                  {imapProviders.map(p => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Protocol Selection - Full Width */}
            <div className="space-y-2">
              <Label htmlFor="incoming.protocol">Protocol</Label>
              <Controller
                control={control}
                name="incoming.protocol"
                render={({ field }) => (
                  <ToggleGroup
                    type="single"
                    value={field.value}
                    onValueChange={value => {
                      field.onChange(value)
                      // Auto-set authType based on protocol selection
                      if (value === 'oauth2') {
                        setValue('authType', 'oauth2')
                      } else {
                        setValue('authType', 'basic')
                      }
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <ToggleGroupItem value="imap" className="flex-1">
                      IMAP
                    </ToggleGroupItem>
                    <ToggleGroupItem value="oauth2" className="flex-1">
                      OAuth2
                    </ToggleGroupItem>
                  </ToggleGroup>
                )}
              />
            </div>
            {/* Server Settings - shown only for IMAP protocol */}
            {watch('incoming.protocol') !== 'oauth2' && (
              <div className="flex gap-2 w-full">
                <div className="flex-1 min-w-0">
                  <Input
                    {...register('incoming.host')}
                    type="text"
                    label="Server Host"
                    error={errors.incoming?.host?.message}
                    floatingLabel
                    labelBackground="rgb(20, 19, 22)"
                  />
                </div>
                <div className="w-18 shrink-0">
                  <Input
                    {...register('incoming.port')}
                    type="number"
                    label="Port"
                    error={errors.incoming?.port?.message}
                    floatingLabel
                    labelBackground="rgb(20, 19, 22)"
                  />
                </div>
              </div>
            )}
          </div>

          {error && error.length > 0 && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive-foreground flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="text-sm break-words">{error}</span>
            </div>
          )}

          {/* SSL/TLS Setting - shown only for IMAP protocol */}
          {watch('incoming.protocol') !== 'oauth2' && (
            <div className="pt-2">
              <Controller
                control={control}
                name="incoming.useTls"
                render={({ field }) => (
                  <Button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    variant={field.value ? 'default' : 'outline'}
                    className="w-full"
                  >
                    SSL/TLS
                  </Button>
                )}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-4 border-t border-border">
            <Button type="submit" disabled={isSubmitting} className="flex-1 min-w-0">
              {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              <span className="ml-2 truncate">{accountToEdit ? 'Save' : 'Add'}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              size="sm"
              className="shrink-0"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AccountForm
