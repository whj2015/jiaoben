import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback 
          error={this.state.error} 
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

const ErrorFallback: React.FC<{
  error: Error | null;
  onReset: () => void;
}> = ({ error, onReset }) => {
  const { t } = useTranslation();
  const errorDetails = error ? {
    message: error.message,
    stack: error.stack
  } : null;

  return (
    <div className="flex flex-col items-center justify-center h-full bg-red-50 p-8">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-red-900">
            {t('errorBoundaryTitle')}
          </h2>
        </div>
        
        <p className="text-red-700 mb-6">
          {t('errorBoundaryMessage')}
        </p>

        {errorDetails && (
          <details className="mb-6">
            <summary className="cursor-pointer text-sm font-medium text-red-600 hover:text-red-800 mb-2">
              {t('errorBoundaryDetails')}
            </summary>
            <div className="bg-red-50 rounded-lg p-4 text-xs font-mono text-red-800 max-h-48 overflow-auto">
              <div className="font-bold mb-2">{errorDetails.message}</div>
              {errorDetails.stack && (
                <pre className="whitespace-pre-wrap break-all opacity-75">
                  {errorDetails.stack}
                </pre>
              )}
            </div>
          </details>
        )}

        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition-colors"
        >
          <RefreshCw size={18} />
          {t('errorBoundaryRetry')}
        </button>
      </div>
    </div>
  );
};

export default ErrorBoundary;
