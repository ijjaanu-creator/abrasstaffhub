import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Intentionally no console logging here (avoid leaking details in production)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-xl border border-border bg-card p-6 shadow-elegant">
            <p className="text-sm font-medium text-foreground">This section couldn’t load.</p>
            <p className="mt-1 text-sm text-muted-foreground">Please refresh or try again later.</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
