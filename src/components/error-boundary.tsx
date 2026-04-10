import { Component, type ReactNode, type ErrorInfo } from 'react';
import { RotateCcw } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error(error.message, info.componentStack ?? undefined);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-background px-8 text-center">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <span className="text-destructive text-lg">!</span>
          </div>
          <h2 className="text-sm font-medium text-foreground mb-1">Something went wrong</h2>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Mira encountered an unexpected error. Your data is safe.
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          >
            <RotateCcw size={14} />
            Try Again
          </button>
          {this.state.error && (
            <pre className="mt-4 text-[9px] text-muted-foreground/40 max-w-full overflow-auto leading-relaxed">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
