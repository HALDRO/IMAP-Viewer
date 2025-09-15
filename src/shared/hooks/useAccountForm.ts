/**
 * @file Hook for managing account form state and logic with improved validation.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// ClipboardService is now accessed via IPC API
import { accountSchema, type Account } from '../types/account';
import type { DiscoveredConfig } from '../types/protocol';

import { useEmailDiscovery } from './useEmailDiscovery';

// New form schema with separate host and port for better validation and UX
const formSchema = accountSchema.omit({ id: true, incoming: true, outgoing: true, connectionStatus: true, useProxy: true, proxy: true }).extend({
  incoming: z.object({
    protocol: z.enum(['imap', 'pop3', 'oauth2']),
    host: z.string().min(1, 'Host cannot be empty'),
    port: z.number().min(1, 'Port cannot be empty'),
    useTls: z.boolean(),
  }),
  outgoing: z.object({
    protocol: z.literal('smtp'),
    host: z.string().min(1, 'Host cannot be empty'),
    port: z.number().min(1, 'Port cannot be empty'),
    useTls: z.boolean(),
  }).optional(),
  refreshToken: z.string().optional(),
  clientId: z.string().optional(),
});

export type AccountFormType = z.infer<typeof formSchema>;

interface UseAccountFormProps {
  accountToEdit?: Account | null;
  initialData?: { email: string; password: string, refreshToken?: string, clientId?: string, isOAuth2?: boolean } | null;
  onSave?: (data: Omit<Account, 'id'>) => Promise<void>;
}
interface UseAccountFormReturn {
    form: ReturnType<typeof useForm<AccountFormType>>;
    isPasswordVisible: boolean;
    setIsPasswordVisible: (visible: boolean) => void;
    error: string | null;
    setError: (error: string | null) => void;
    showProviderSuggestions: boolean;
    setShowProviderSuggestions: (show: boolean) => void;
    discovery: ReturnType<typeof useEmailDiscovery>;
    handleProviderSelect: (config: DiscoveredConfig) => void;
    handleManualDiscovery: () => Promise<void>;
    handleEmailBlur: (e: React.FocusEvent<HTMLInputElement>) => Promise<void>;
    handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
    parseCredentialsString: (text: string) => Promise<boolean>;
}


export const useAccountForm = (props: UseAccountFormProps): UseAccountFormReturn => {
  const { accountToEdit, initialData, onSave } = props;
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProviderSuggestions, setShowProviderSuggestions] = useState(false);
  const isDiscoveringRef = useRef(false);

  const discovery = useEmailDiscovery();
  const { discoverEmailSettings } = discovery;

  const form = useForm<AccountFormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      incoming: {
        protocol: 'imap',
        host: 'imap.example.com',
        port: 993,
        useTls: true,
      },
    },
  });

  const { reset, setValue, trigger, handleSubmit: formHandleSubmit, getValues } = form;

  // Use refs to track previous values and prevent unnecessary resets
  const prevAccountToEditRef = useRef<Account | null | undefined>(undefined);
  const prevInitialDataRef = useRef<typeof initialData>(undefined);

  useEffect(() => {
    // Only reset if accountToEdit actually changed
    if (accountToEdit && accountToEdit !== prevAccountToEditRef.current && !isDiscoveringRef.current) {
      console.log('Resetting form with accountToEdit:', accountToEdit);
      prevAccountToEditRef.current = accountToEdit;

      // Auto-detect OAuth2 if credentials present
      const isOAuth2 = !!(accountToEdit.clientId || accountToEdit.refreshToken);
      const accountWithAuthType = {
        ...accountToEdit,
        authType: isOAuth2 ? 'oauth2' as const : 'basic' as const,
        incoming: {
          ...accountToEdit.incoming,
          protocol: isOAuth2 ? 'oauth2' as const : accountToEdit.incoming.protocol
        }
      };
      reset(accountWithAuthType);
      return;
    }

    // Only process initialData if it actually changed
    if (initialData && initialData !== prevInitialDataRef.current) {
      console.log('Processing initialData:', initialData);
      prevInitialDataRef.current = initialData;

      setValue('email', initialData.email, { shouldValidate: true });
      setValue('password', initialData.password, { shouldValidate: true });
      if (initialData.refreshToken) {
        form.setValue('refreshToken', initialData.refreshToken);
      }
      if (initialData.clientId) {
        form.setValue('clientId', initialData.clientId);
      }
      // Auto-detect OAuth2 from clipboard data
      if (initialData.isOAuth2) {
        form.setValue('authType', 'oauth2');
        form.setValue('incoming.protocol', 'oauth2');
      }
      setTimeout(() => {
        void discoverEmailSettings(initialData.email, false, setValue);
      }, 500);
      return;
    }

    // Only reset to defaults if both accountToEdit and initialData are null/undefined
    // and we haven't already reset
    if (!accountToEdit && !initialData &&
        prevAccountToEditRef.current !== null &&
        prevInitialDataRef.current !== null) {
      console.log('Resetting form to defaults');
      prevAccountToEditRef.current = null;
      prevInitialDataRef.current = null;

      reset({
        displayName: '',
        email: '',
        password: '',
        authType: 'basic',
        incoming: { protocol: 'imap', host: '', port: 993, useTls: true },
      });
    }
  }, [accountToEdit, initialData, reset, setValue]);

  const handleProviderSelect = useCallback((config: DiscoveredConfig) => {
    discovery.applyDiscoveredConfig(config, setValue);
    setShowProviderSuggestions(false);
  }, [discovery, setValue]);

  const handleManualDiscovery = useCallback(async () => {
    console.log('handleManualDiscovery called');
    const email = getValues('email');
    console.log(`Email from form: ${email}`);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email to run discovery.');
      return;
    }
    setError(null);
    isDiscoveringRef.current = true;
    console.log(`Forcing manual discovery for ${email}... (bypassing all caches)`);
    try {
      await discoverEmailSettings(email, true, setValue);
      // After discovery, the form's internal state is updated via `setValue`.
      // No need to reset - setValue should have already updated the form state
      console.log('Discovery completed, form should be updated via setValue');
    } finally {
      isDiscoveringRef.current = false;
    }
  }, [getValues, setError, discoverEmailSettings, setValue]);

  const parseCredentialsString = useCallback(async (text: string): Promise<boolean> => {
    // First try to detect OAuth2 format using the same logic as clipboard detection
    const clipboardResult = await window.ipcApi.detectCredentialsFromClipboard() as any;

    // If clipboard detection found OAuth2 credentials, use those
    if (clipboardResult.success && clipboardResult.credentials?.isOAuth2) {
      const credentials = clipboardResult.credentials;
      setValue('email', credentials.email, { shouldValidate: true });
      setValue('password', credentials.password, { shouldValidate: true });
      setValue('authType', 'oauth2');
      setValue('incoming.protocol', 'oauth2');

      if (credentials.refreshToken) {
        setValue('refreshToken', credentials.refreshToken);
      }
      if (credentials.clientId) {
        setValue('clientId', credentials.clientId);
      }

      // Run discovery when credentials are detected from clipboard (only for new accounts)
      if (!accountToEdit && /^\S+@\S+\.\S+$/.test(credentials.email)) {
        console.log('Running discovery for OAuth2 credentials from clipboard:', credentials.email);
        await discoverEmailSettings(credentials.email, false, setValue);
      }
      return true;
    }

    // Fallback to basic parsing for non-OAuth2 credentials
    const result = await window.ipcApi.parseCredentialsString(text) as any;
    if (result.success && result.credentials) {
      setValue('email', result.credentials.email, { shouldValidate: true });
      setValue('password', result.credentials.password, { shouldValidate: true });

      // Run discovery when credentials are detected from clipboard (only for new accounts)
      if (!accountToEdit && /^\S+@\S+\.\S+$/.test(result.credentials.email)) {
        console.log('Running discovery for basic credentials from clipboard:', result.credentials.email);
        await discoverEmailSettings(result.credentials.email, false, setValue);
      }
      return true;
    }
    return false;
  }, [setValue, discoverEmailSettings, accountToEdit]);

  // No automatic discovery - only manual discovery via button or clipboard detection

  const handleEmailBlur = useCallback(async (e: React.FocusEvent<HTMLInputElement>) => {
    const email = e.target.value.trim();

    // Check if the email looks like it might be from a pasted credential string
    // If it contains separators, try to parse credentials from clipboard
    if (email.includes(':') || email.includes('|')) {
      await parseCredentialsString(email);
    }
  }, [parseCredentialsString]);

  const handleSubmit = useCallback(async (e?: React.BaseSyntheticEvent) => {
    if (e) e.preventDefault();

    console.log('handleSubmit called');

    return formHandleSubmit(async (data: AccountFormType) => {
      console.log('Form data:', data);
      console.log('Incoming data:', JSON.stringify(data.incoming, null, 2));
      setError(null);

      // Only run discovery for new accounts with empty/example hosts
      // Don't run discovery when editing existing accounts - respect user's manual changes
      const isNewAccount = !accountToEdit;
      const needsDiscovery = isNewAccount && (
        !data.incoming.host ||
        data.incoming.host.includes('example.com') ||
        data.incoming.host === 'imap.example.com' ||
        data.incoming.host === ''
      );

      if (needsDiscovery && /^\S+@\S+\.\S+$/.test(data.email)) {
        console.log('Running discovery for new account...');
        try {
          await discoverEmailSettings(data.email, true, setValue);

          // Use updated data if discovery was successful
          if (discovery.discoveryStatus === 'found') {
            // Trigger validation to update the form's internal state and UI
            await trigger();
            const updatedData = getValues();
            console.log('Updated data after discovery:', updatedData);
            Object.assign(data, updatedData);
          }
        } catch (discoveryError) {
          console.warn('Discovery failed, proceeding with manual settings:', discoveryError);
        }
      } else if (accountToEdit) {
        console.log('Editing existing account - using manual settings without discovery');
      }

      const finalData: Omit<Account, 'id'> = {
        ...data,
        displayName: data.displayName || data.email.split('@')[0],
      };

      console.log('Final data to save:', finalData);
      console.log('Final incoming data:', JSON.stringify(finalData.incoming, null, 2));

      try {
        await onSave?.(finalData);
        console.log('Account saved successfully');
      } catch (e: unknown) {
        console.error('Failed to save account:', e);
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        setError(errorMessage);
      }
    })(e);
  }, [formHandleSubmit, onSave, discoverEmailSettings, setValue, getValues, accountToEdit, trigger]);

  return {
    form,
    isPasswordVisible,
    setIsPasswordVisible,
    error,
    setError,
    showProviderSuggestions,
    setShowProviderSuggestions,
    discovery,
    handleProviderSelect,
    handleManualDiscovery,
    handleEmailBlur,
    handleSubmit,
    parseCredentialsString,
  };
};