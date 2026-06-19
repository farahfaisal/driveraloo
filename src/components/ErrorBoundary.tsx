import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">عذراً، حدث خطأ ما</h1>
            <p className="text-gray-600 mb-6">
              نعتذر عن هذا الخطأ. يرجى إعادة تحميل التطبيق أو المحاولة مرة أخرى لاحقاً.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              إعادة تحميل التطبيق
            </button>
            {this.state.error && (
              <p className="mt-4 text-sm text-gray-500">
                {this.state.error.toString()}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}