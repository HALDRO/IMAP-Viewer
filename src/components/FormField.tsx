/**
 * @file Accessible form field components with validation using ShadCN UI
 */
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import React, { forwardRef, useState } from 'react';

import { Checkbox } from '../shared/ui/checkbox';
import { Input } from '../shared/ui/input';
import { Label } from '../shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shared/ui/select';
import { cn } from '../shared/utils/utils';

interface FormFieldProps {
  label: string;
  id: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel';
  value: string;
  onChange: (_value: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  description?: string;
}

/**
 * Accessible form input field with validation and error handling
 */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(({
  label,
  id,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false,
  autoComplete,
  className = '',
  description
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  const inputId = id;
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={inputId} className="text-sm font-medium">
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-label="required">*</span>
        )}
      </Label>

      {(description?.length ?? 0) > 0 && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      <div className="relative">
        <Input
          ref={ref}
          id={inputId}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={(error?.length ?? 0) > 0 ? 'true' : 'false'}
          aria-describedby={`${(error?.length ?? 0) > 0 ? errorId : ''} ${(description?.length ?? 0) > 0 ? descriptionId : ''}`.trim()}
          className={cn(
            (error?.length ?? 0) > 0 && "border-destructive focus-visible:ring-destructive",
            isPassword && "pr-10"
          )}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {(error?.length ?? 0) > 0 && (
        <div id={errorId} className="flex items-center gap-2 text-sm text-destructive" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
});

FormField.displayName = 'FormField';

interface SelectFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (_value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  description?: string;
  placeholder?: string;
}

/**
 * Accessible select field component
 */
export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  id,
  value,
  onChange,
  options,
  error,
  required = false,
  disabled = false,
  className = '',
  description,
  placeholder = "Select an option..."
}) => {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-label="required">*</span>
        )}
      </Label>

      {(description?.length ?? 0) > 0 && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className={cn(
            (error?.length ?? 0) > 0 && "border-destructive focus:ring-destructive"
          )}
          aria-invalid={(error?.length ?? 0) > 0 ? 'true' : 'false'}
          aria-describedby={`${(error?.length ?? 0) > 0 ? errorId : ''} ${(description?.length ?? 0) > 0 ? descriptionId : ''}`.trim()}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(error?.length ?? 0) > 0 && (
        <div id={errorId} className="flex items-center gap-2 text-sm text-destructive" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

interface CheckboxFieldProps {
  label: string;
  id: string;
  checked: boolean;
  onChange: (_checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  description?: string;
}

/**
 * Accessible checkbox field component
 */
export const CheckboxField: React.FC<CheckboxFieldProps> = ({
  label,
  id,
  checked,
  onChange,
  disabled = false,
  className = '',
  description
}) => {
  const descriptionId = `${id}-description`;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
          aria-describedby={(description?.length ?? 0) > 0 ? descriptionId : undefined}
          className="mt-1"
        />
        <div className="flex-1">
          <Label
            htmlFor={id}
            className="text-sm font-medium cursor-pointer"
          >
            {label}
          </Label>
          {(description?.length ?? 0) > 0 && (
            <p id={descriptionId} className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};


