import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  /** Optional section label for Sentry context (e.g. "admin", "partner") */
  section?: string;
  /** Optional fallback to render instead of default error card */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });

    // Report to Sentry with section context
    Sentry.withScope((scope) => {
      if (this.props.section) {
        scope.setTag('section', this.props.section);
      }
      if (errorInfo.componentStack) {
        scope.setExtra('componentStack', errorInfo.componentStack);
      }
      Sentry.captureException(error);
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      const isDevelopment = import.meta.env.DEV;
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
          <Card className="max-w-2xl w-full border-destructive/20 shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 rounded-full bg-destructive/10">
                  <AlertCircle className="w-7 h-7 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Something went wrong</CardTitle>
                  <CardDescription className="mt-1">
                    We've encountered an unexpected error. Our team has been notified.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-destructive mb-2">Error Details:</p>
                <p className="text-sm text-muted-foreground font-mono break-words">
                  {this.state.error?.message || 'An unknown error occurred'}
                </p>
              </div>

              {isDevelopment && this.state.errorInfo && (
                <details className="bg-muted/50 border rounded-lg p-4">
                  <summary className="text-sm font-semibold cursor-pointer mb-2">Stack Trace</summary>
                  <pre className="text-xs text-muted-foreground overflow-x-auto mt-2 whitespace-pre-wrap font-mono">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-3 pt-2">
                <Button onClick={this.handleReset} className="flex-1 gap-2" size="lg">
                  <Home className="w-4 h-4" />
                  Return to Home
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()} className="flex-1 gap-2" size="lg">
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
