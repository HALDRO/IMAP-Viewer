/**
 * @file Proxy add form sub-components
 */
import { Plus } from 'lucide-react';
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { ProxyFormData } from '../../shared/hooks/useProxyManager';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { ToggleGroup, ToggleGroupItem } from '../../shared/ui/toggle-group';
import { Tooltip } from '../../shared/ui/tooltip';

/**
 * Proxy type selection component
 */
export const ProxyTypeSelector: React.FC<{
  quickProxyType: 'http' | 'https' | 'socks4' | 'socks5';
  setQuickProxyType: (type: 'http' | 'https' | 'socks4' | 'socks5') => void;
}> = ({ quickProxyType, setQuickProxyType }) => (
  <div className="flex-1">
    <ToggleGroup
      type="single"
      value={quickProxyType}
      onValueChange={(value) => {
        if (value && ['http', 'https', 'socks4', 'socks5'].includes(value)) {
          setQuickProxyType(value as 'http' | 'https' | 'socks4' | 'socks5');
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
);

/**
 * Add proxy button component
 */
export const AddProxyButton: React.FC<{
  form: UseFormReturn<ProxyFormData>;
  quickProxyType: 'http' | 'https' | 'socks4' | 'socks5';
  handleAddProxy: (data: ProxyFormData & { type?: 'http' | 'https' | 'socks4' | 'socks5' }) => void;
}> = ({ form, quickProxyType, handleAddProxy }) => {
  const handleClick = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();

    const isValid = await form.trigger();
    if (isValid) {
      const data = form.getValues();
      handleAddProxy({...data, type: quickProxyType});
    }
  };

  return (
    <Tooltip content="Add new proxy with current settings">
      <Button
        type="button"
        onClick={(e) => void handleClick(e)}
        size="sm"
        className="h-9 px-4 gap-2"
      >
        <Plus size={16} />
        Add Proxy
      </Button>
    </Tooltip>
  );
};

/**
 * Host and port input fields
 */
export const HostPortInputs: React.FC<{
  form: UseFormReturn<ProxyFormData>;
}> = ({ form }) => (
  <div className="grid grid-cols-2 gap-3">
    <Input
      id="quick-host"
      label="Host"
      floatingLabel
      {...form.register('host')}
    />
    <Input
      id="quick-port"
      type="number"
      label="Port"
      floatingLabel
      {...form.register('port', { valueAsNumber: true })}
    />
  </div>
);

/**
 * Username and password input fields
 */
export const AuthInputs: React.FC<{
  form: UseFormReturn<ProxyFormData>;
}> = ({ form }) => (
  <div className="grid grid-cols-2 gap-3">
    <Input
      id="quick-username"
      label="Username (Optional)"
      floatingLabel
      {...form.register('username')}
    />
    <Input
      id="quick-password"
      type="password"
      label="Password (Optional)"
      floatingLabel
      {...form.register('password')}
    />
  </div>
);
