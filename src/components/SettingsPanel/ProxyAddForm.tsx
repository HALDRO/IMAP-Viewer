/**
 * @file Proxy add form component
 */
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { ProxyFormData } from '../../shared/hooks/useProxyManager';
import { Card, CardContent } from '../../shared/ui/card';

import { AddProxyButton, AuthInputs, HostPortInputs, ProxyTypeSelector } from './ProxyAddFormComponents';

interface ProxyAddFormProps {
  form: UseFormReturn<ProxyFormData>;
  quickProxyType: 'http' | 'https' | 'socks4' | 'socks5';
  setQuickProxyType: (_type: 'http' | 'https' | 'socks4' | 'socks5') => void;
  handleAddProxy: (_data: ProxyFormData & { type?: 'http' | 'https' | 'socks4' | 'socks5' }) => void;
}

/**
 * Form component for adding new proxies
 */
export const ProxyAddForm: React.FC<ProxyAddFormProps> = ({
  form,
  quickProxyType,
  setQuickProxyType,
  handleAddProxy
}) => {
  return (
    <Card className="mb-4 border-0 shadow-none">
      <CardContent className="space-y-4">
        {/* First Row: Type Selection + Add Button */}
        <div className="flex items-end justify-between gap-4">
          <ProxyTypeSelector
            quickProxyType={quickProxyType}
            setQuickProxyType={setQuickProxyType}
          />
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
      </CardContent>
    </Card>
  );
};

export default ProxyAddForm;
