import * as React from "react"
import { Eye, EyeOff, Copy, Check, X } from "lucide-react"

import { cn } from "../utils/utils"
import { Label } from "./label"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  floatingLabel?: boolean
  hideCopyButton?: boolean
  hideClearButton?: boolean
  hidePasswordToggle?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, floatingLabel, hideCopyButton, hideClearButton, hidePasswordToggle, id, onChange, value, ...props }, ref) => {
    const inputId = id || `input-${React.useId()}`
    const [showPassword, setShowPassword] = React.useState(false)
    const [copied, setCopied] = React.useState(false)

    // Determine which buttons to show (enabled by default, can be hidden)
    const showCopyButton = !hideCopyButton
    const showClearButton = !hideClearButton
    const showPasswordToggle = type === 'password' && !hidePasswordToggle

    // Determine if we need to show any action buttons
    const hasActions = showPasswordToggle || showCopyButton || showClearButton
    const isPasswordField = type === 'password' && showPasswordToggle
    const actualType = isPasswordField && showPassword ? 'text' : type

    // Handle copy functionality
    const handleCopy = async () => {
      if (value) {
        try {
          await navigator.clipboard.writeText(String(value))
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch (err) {
          console.error('Failed to copy:', err)
        }
      }
    }

    // Handle clear functionality
    const handleClear = () => {
      if (onChange) {
        const event = {
          target: { value: '' },
          currentTarget: { value: '' }
        } as React.ChangeEvent<HTMLInputElement>
        onChange(event)
      }
    }

    // If floating label is requested, render the complete floating label structure
    if (floatingLabel && label) {
      return (
        <div className="space-y-2">
          <div className={cn("relative", hasActions ? "group" : "")}>
            <input
              id={inputId}
              type={actualType}
              placeholder=" "
              data-slot="input"
              className={cn(
                "peer file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex h-10 w-full min-w-0 rounded-md border bg-transparent px-4 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
                error ? "border-destructive focus-visible:ring-destructive" : "",
                "py-2",
                className
              )}
              ref={ref}
              value={value}
              onChange={onChange}
              {...props}
            />
            <Label
              htmlFor={inputId}
              className="absolute left-4 -top-2.5 bg-background px-2 text-sm font-medium text-muted-foreground transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:text-muted-foreground peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-foreground"
            >
              {label}
            </Label>

            {/* Action buttons */}
            {hasActions && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto transition-opacity duration-200 bg-background rounded-md shadow-sm">
                {showPasswordToggle && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-muted"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
                {showCopyButton && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-muted"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}
                {showClearButton && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-muted"
                    title="Clear field"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>
      )
    }

    // Default input without floating label
    if (hasActions) {
      return (
        <div className="relative group">
          <input
            id={inputId}
            type={actualType}
            data-slot="input"
            className={cn(
              "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex h-10 w-full min-w-0 rounded-md border bg-transparent px-4 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
              className
            )}
            ref={ref}
            value={value}
            onChange={onChange}
            {...props}
          />

          {/* Action buttons */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto transition-opacity duration-200 bg-background rounded-md shadow-sm">
            {showPasswordToggle && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-muted"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
            {showCopyButton && (
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-muted"
                title="Copy to clipboard"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}
            {showClearButton && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-muted"
                title="Clear field"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )
    }

    return (
      <input
        id={inputId}
        type={actualType}
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex h-10 w-full min-w-0 rounded-md border bg-transparent px-4 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className
        )}
        ref={ref}
        value={value}
        onChange={onChange}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
