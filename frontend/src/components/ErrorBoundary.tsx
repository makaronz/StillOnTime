import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorType: 'network' | 'auth' | 'general' | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Determine error type based on error message
    let errorType: 'network' | 'auth' | 'general' = 'general';

    if (error.message) {
      const message = error.message.toLowerCase();
      if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
        errorType = 'network';
      } else if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('401')) {
        errorType = 'auth';
      }
    }

    return {
      hasError: true,
      error,
      errorType,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught an error:', error, errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: sendErrorToService(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  getErrorMessage = () => {
    const { errorType } = this.state;

    if (errorType === 'network') {
      return {
        title: 'Connection Error',
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
        action: 'Retry Connection'
      };
    }

    if (errorType === 'auth') {
      return {
        title: 'Authentication Error',
        message: 'Your session has expired or you don\'t have permission to access this resource.',
        action: 'Go to Login'
      };
    }

    return {
      title: 'Something went wrong',
      message: 'An unexpected error occurred. Our team has been notified.',
      action: 'Try Again'
    };
  };

  render() {
    if (this.state.hasError) {
      const { title, message, action } = this.getErrorMessage();
      const { errorType } = this.state;

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className={clsx(
                "p-3 rounded-full",
                errorType === 'network' && "bg-red-100",
                errorType === 'auth' && "bg-yellow-100",
                errorType === 'general' && "bg-gray-100"
              )}>
                <AlertTriangle className={clsx(
                  "w-6 h-6",
                  errorType === 'network' && "text-red-600",
                  errorType === 'auth' && "text-yellow-600",
                  errorType === 'general' && "text-gray-600"
                )} />
              </div>
            </div>

            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {title}
            </h1>

            <p className="text-gray-600 mb-6">
              {message}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {errorType === 'network' ? (
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  {action}
                </button>
              ) : errorType === 'auth' ? (
                <a
                  href="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {action}
                </a>
              ) : (
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  {action}
                </button>
              )}

              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error Details (Development Only)
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-800 overflow-auto max-h-32">
                  <div className="font-semibold mb-1">Error:</div>
                  <div className="mb-2">{this.state.error.message}</div>
                  {this.state.errorInfo && (
                    <>
                      <div className="font-semibold mb-1">Component Stack:</div>
                      <pre className="whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Helper function for className conditional logic
function clsx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export default ErrorBoundary;