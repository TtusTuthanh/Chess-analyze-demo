import { Component } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="recovery">
        <h1>Let’s get you back to the board.</h1>
        <p>The workspace could not be restored. Downloaded projects are safe.</p>
        <button
          onClick={() => {
            localStorage.removeItem('chess-pgn-analyzer-v1');
            location.reload();
          }}
        >
          Reset local workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
