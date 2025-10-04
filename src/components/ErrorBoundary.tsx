/**
 * @file Error boundary component for catching and displaying React errors gracefully
 */
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

/**
 * Error boundary component that catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update state with error info for display
    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback !== undefined) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-background text-foreground">
          <div className="bg-red-900/20 p-8 rounded-xl border border-red-800/30 max-w-md text-center backdrop-blur-lg">
            <div className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center bg-red-900/30">
              <AlertTriangle size={32} className="text-red-400" />
            </div>
            <h2 className="text-xl font-medium mb-3 text-red-300">Something went wrong</h2>
            <p className="text-sm text-gray-400 mb-6">
              Something went wrong. Please try again or restart the application.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-red-300 mb-2">
                  Error Details
                </summary>
                <pre className="text-xs text-red-200 bg-red-900/30 p-3 rounded overflow-auto max-h-32">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <button
              type="button"
              onClick={this.handleReset}
              className="px-5 py-2.5 bg-red-900/30 hover:bg-red-900/50 text-red-200 rounded-full text-sm transition-colors flex items-center justify-center mx-auto gap-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Try again"
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
