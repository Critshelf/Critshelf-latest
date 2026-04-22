import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public props: Props;
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(error?.message || "");
        if (parsed.error && parsed.operationType) {
          message = `Firestore ${parsed.operationType} error: ${parsed.error}`;
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-charcoal p-4">
          <div className="bg-white/5 p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center border border-white/10 backdrop-blur-xl">
            <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
              <h2 className="text-3xl font-black text-rose-500">!</h2>
            </div>
            <h2 className="text-2xl font-black text-white mb-4 tracking-tight">System Error</h2>
            <p className="text-white/40 font-bold mb-8 leading-relaxed">{message}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-accent text-charcoal py-4 rounded-xl font-black shadow-lg hover:shadow-emerald-accent/20 transition-all active:scale-95"
            >
              Reload Interface
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
