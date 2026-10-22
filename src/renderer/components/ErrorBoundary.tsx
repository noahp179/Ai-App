import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Keeps one broken module from taking down the whole window. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI error', error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="banner danger" role="alert">
            <div className="grow">
              <div style={{ fontWeight: 600 }}>This section hit an error</div>
              <div className="small">{this.state.error.message}</div>
              <div className="row" style={{ marginTop: 8 }}>
                <button type="button" className="btn sm" onClick={() => this.setState({ error: null })}>
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
