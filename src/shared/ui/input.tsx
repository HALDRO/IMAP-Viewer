/**
 * @file Input component with extended features
 * @description Input wrapper with label, error state, floating label support,
 * and copy button functionality. Fully typed for TypeScript.
 */
import { Check, Copy } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/shared/utils/utils'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input label text */
  label?: string
  /** Error message to display */
  error?: string
  /** Enable floating label style */
  floatingLabel?: boolean
  /** Background color for floating label */
  labelBackground?: string
  /** Hide the copy button (for sensitive fields) */
  hideCopyButton?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      label,
      error,
      floatingLabel = false,
      labelBackground = 'rgb(var(--background))',
      hideCopyButton = false,
      id,
      ...props
    },
    ref
  ) => {
    const [copied, setCopied] = React.useState(false)
    const inputId = id || React.useId()
    const inputRef = React.useRef<HTMLInputElement | null>(null)

    // Combine refs
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const handleCopy = async () => {
      if (inputRef.current?.value) {
        try {
          await navigator.clipboard.writeText(inputRef.current.value)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch (err) {
          console.error('Failed to copy:', err)
        }
      }
    }

    // If using floating label
    if (floatingLabel && label) {
      return (
        <div className="relative">
          <input
            id={inputId}
            type={type}
            ref={inputRef}
            className={cn(
              'peer flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
              error && 'border-destructive focus-visible:ring-destructive',
              !hideCopyButton && type !== 'password' && 'pr-10',
              className
            )}
            {...props}
          />
          <label
            htmlFor={inputId}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-focus:top-0 peer-focus:text-xs peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs px-1 pointer-events-none"
            style={{ background: labelBackground }}
          >
            {label}
          </label>
          {!hideCopyButton && type !== 'password' && inputRef.current?.value && (
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Copy to clipboard"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          )}
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
      )
    }

    // Standard input with label
    if (label) {
      return (
        <div className="space-y-2">
          <label
            htmlFor={inputId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
          >
            {label}
          </label>
          <div className="relative">
            <input
              id={inputId}
              type={type}
              ref={inputRef}
              className={cn(
                'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                error && 'border-destructive focus-visible:ring-destructive',
                !hideCopyButton && type !== 'password' && 'pr-10',
                className
              )}
              {...props}
            />
            {!hideCopyButton && type !== 'password' && inputRef.current?.value && (
              <button
                type="button"
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                title="Copy to clipboard"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}
          </div>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
      )
    }

    // Basic input without label
    return (
      <div className="relative">
        <input
          id={inputId}
          type={type}
          ref={inputRef}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            error && 'border-destructive focus-visible:ring-destructive',
            !hideCopyButton && type !== 'password' && 'pr-10',
            className
          )}
          {...props}
        />
        {!hideCopyButton && type !== 'password' && inputRef.current?.value && (
          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
