import React from 'react';

interface ErrorBoundaryProps {
  /** Rendered instead of the children after they throw; `retry` remounts them. */
  fallback: (retry: () => void) => React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
  attempt: number;
}

/**
 * Contains a failure (an error while rendering, in an effect, or a lazy
 * chunk that won't load) to one part of the page instead of unmounting the
 * whole app. React only supports this as a class component.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('A part of the page failed and was contained:', error);
  }

  private retry = () =>
    this.setState(state => ({ failed: false, attempt: state.attempt + 1 }));

  render(): React.ReactNode {
    if (this.state.failed) return this.props.fallback(this.retry);
    // A new key on retry remounts the children from scratch.
    return (
      <React.Fragment key={this.state.attempt}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
