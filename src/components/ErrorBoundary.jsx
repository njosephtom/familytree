import { Component } from 'react';

const T = {
  bg: '#eef2f7', text: '#1c2d3e', textSub: '#5a7a96', textMuted: '#8aafc0',
  red: '#d94f4f', panelBorder: '#dde6f0', accent: '#3a78c9',
};
const SF = "'Nunito', 'Segoe UI', sans-serif";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const msg = this.state.error?.message || String(this.state.error);

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 16, background: T.bg, fontFamily: SF, padding: 32,
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <p style={{ color: T.text, fontSize: 16, fontWeight: 800, margin: 0 }}>Something went wrong</p>
        <p style={{ color: T.textSub, fontSize: 13, margin: 0, maxWidth: 480, textAlign: 'center' }}>
          The family tree could not be rendered. Try switching trees or refreshing the page.
        </p>
        <pre style={{
          background: '#fff', border: `1px solid ${T.panelBorder}`, borderRadius: 10,
          padding: '10px 14px', fontSize: 11, color: T.red, maxWidth: 560, overflowX: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
        }}>
          {msg}
        </pre>
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            background: T.accent, color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: SF,
          }}
        >
          Try Again
        </button>
      </div>
    );
  }
}
