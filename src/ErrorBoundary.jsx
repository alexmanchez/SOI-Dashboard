import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          padding: 32,
          color: '#EEF3FA',
          fontFamily: 'system-ui',
          backgroundColor: '#070B14',
          minHeight: '100vh',
        }}
      >
        <h2 style={{ color: '#E25D6E' }}>Something went wrong.</h2>
        <pre
          style={{
            marginTop: 16,
            padding: 16,
            backgroundColor: '#0D1524',
            border: '1px solid #1E2B45',
            borderRadius: 6,
            overflowX: 'auto',
            fontSize: 12,
          }}
        >
          {String(this.state.error)}
          {'\n\n'}
          {this.state.info?.componentStack}
        </pre>
        <button
          onClick={() => location.reload()}
          style={{
            marginTop: 16,
            padding: '8px 16px',
            backgroundColor: '#22D3C5',
            color: '#070B14',
            border: 0,
            borderRadius: 4,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
