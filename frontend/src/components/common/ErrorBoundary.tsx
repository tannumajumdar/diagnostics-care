import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '../ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React Component Tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-background p-6 select-none">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl border text-center space-y-4 text-xs">
            <div className="h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">Something went wrong</h1>
              <p className="text-muted-foreground mt-1">
                An unexpected component rendering error occurred. You can reload or return to the dashboard.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-muted/40 font-mono text-[10px] text-red-500 text-left overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <Button onClick={this.handleReset} className="w-full bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="h-4 w-4 mr-2" /> Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

