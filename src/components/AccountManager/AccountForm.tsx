/**
 * @file Refactored account form component for a better user experience.
 */

import { ArrowLeft, Save, RefreshCw, AlertCircle } from 'lucide-react';
import React, { useEffect } from 'react';
import { Controller } from 'react-hook-form';


import { useAccountForm } from '../../shared/hooks/useAccountForm';
import { imapProviders } from '../../shared/store/imapProviders';
import type { Account } from '../../shared/types/account';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../shared/ui/select';

import { ToggleGroup, ToggleGroupItem } from '../../shared/ui/toggle-group';
import { cn } from '../../shared/utils/utils';

// ... (interface definition remains the same)
interface AccountFormProps {
    accountToEdit?: Account | null;
    onCancel: () => void;
    onSuccess: (_data: Omit<Account, 'id'>) => Promise<void>;
    initialData?: {
      email: string;
      password: string;
    } | null;
}

const AccountForm: React.FC<AccountFormProps> = ({ accountToEdit, onCancel, onSuccess, initialData }) => {
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
  } = useAccountForm({ accountToEdit, initialData, onSave: onSuccess });

  const { register, formState: { errors, isSubmitting }, control, watch, setValue } = form;
  const watchedEmail = watch('email');

  useEffect(() => {
    if (discovery.discoveryStatus === 'failed') {
      setShowProviderSuggestions(true);
    } else {
      setShowProviderSuggestions(false);
    }
  }, [discovery.discoveryStatus, setShowProviderSuggestions]);

  // Auto-select OAuth2 tab for Microsoft accounts when editing
  useEffect(() => {
    if (accountToEdit && (accountToEdit.clientId || accountToEdit.refreshToken)) {
      setValue('authType', 'oauth2');
    }
  }, [accountToEdit, setValue]);

  return (
    <div className="h-full flex flex-col bg-background text-foreground w-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 border-b border-border flex-shrink-0 h-12">
        <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-full">
          <ArrowLeft size={20} />
        </Button>
        <h2 className="text-xl font-semibold truncate">
          {accountToEdit ? 'Edit Account' : 'Add New Account'}
        </h2>
      </div>

      {/* Form */}
      <div className="flex-grow overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Credentials */}
          <div className="space-y-4">
            {/* Email Field */}
            <Input
              {...register('email')}
              type="email"
              label="Email Address *"
              error={errors.email?.message}
              floatingLabel
              onBlur={handleEmailBlur}
            />

            {/* Password Field */}
            <Input
              {...register('password')}
              type="password"
              label={`Password ${watch('authType') !== 'oauth2' ? '*' : ''}`}
              error={errors.password?.message}
              floatingLabel
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
                />

                <Input
                  {...register('refreshToken')}
                  type="text"
                  label="Refresh Token *"
                  error={errors.refreshToken?.message}
                  floatingLabel
                />
              </>
            )}
          </div>

          {/* Discovery Status & Manual Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Server</h3>
                <Button type="button" variant="outline" size="default" onClick={handleManualDiscovery} disabled={discovery.isDiscovering || !watchedEmail}>
                    <RefreshCw size={16} className={cn(discovery.isDiscovering && 'animate-spin', 'mr-2')} />
                    Auto Detect
                </Button>
            </div>

            {discovery.isDiscovering && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Discovering email settings...</span>
                        <span className="text-xs">This may take up to 60 seconds</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '100%'}}></div>
                    </div>
                </div>
            )}

            {discovery.discoveryStatus === 'failed' && (
                <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
                    <p className="text-sm">{discovery.discoveryMessage}</p>
                    <p className="text-xs mt-1">Please select a provider or enter settings manually.</p>
                </div>
            )}

            {showProviderSuggestions && (
                <Select onValueChange={(name) => handleProviderSelect(imapProviders.find(p => p.name === name)!.config)}>
                    <SelectTrigger><SelectValue placeholder="Select a common provider..." /></SelectTrigger>
                    <SelectContent>{imapProviders.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
            )}

            {/* Protocol Selection - Full Width */}
            <div className="space-y-2">
                <Label htmlFor="incoming.protocol">Protocol</Label>
                <Controller control={control} name="incoming.protocol" render={({ field }) => (
                    <ToggleGroup type="single" value={field.value} onValueChange={(value) => {
                        field.onChange(value);
                        // Auto-set authType based on protocol selection
                        if (value === 'oauth2') {
                            setValue('authType', 'oauth2');
                        } else {
                            setValue('authType', 'basic');
                        }
                    }} variant="outline" className="w-full">
                        <ToggleGroupItem value="imap" className="flex-1">IMAP</ToggleGroupItem>
                        <ToggleGroupItem value="pop3" className="flex-1">POP3</ToggleGroupItem>
                        <ToggleGroupItem value="oauth2" className="flex-1">OAuth2</ToggleGroupItem>
                    </ToggleGroup>
                )} />
            </div>
            {/* Server Settings - shown only for IMAP/POP3 protocols */}
            {watch('incoming.protocol') !== 'oauth2' && (
              <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                      <Input
                        {...register('incoming.host')}
                        type="text"
                        label="Server Host"
                        error={errors.incoming?.host?.message}
                        floatingLabel
                      />
                  </div>
                  <div className="max-w-32">
                      <Input
                        {...register('incoming.port')}
                        type="number"
                        label="Port"
                        error={errors.incoming?.port?.message}
                        floatingLabel
                        className="max-w-full"
                      />
                  </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive-foreground">
              <AlertCircle size={18} className="inline mr-2" /> {error}
            </div>
          )}

          {/* SSL/TLS Setting - shown only for IMAP/POP3 protocols */}
          {watch('incoming.protocol') !== 'oauth2' && (
            <div className="pt-2">
              <Controller control={control} name="incoming.useTls" render={({ field }) => (
                <Button type="button" onClick={() => field.onChange(!field.value)} variant={field.value ? 'default' : 'outline'} className="w-full">
                  SSL/TLS
                </Button>
              )} />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4 border-t border-border">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}<span className="ml-2">{accountToEdit ? 'Save Changes' : 'Add Account'}</span>
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
};



export default AccountForm;