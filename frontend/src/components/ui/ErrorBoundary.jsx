import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary p-6">
          <div className="card max-w-md w-full text-center space-y-5">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-danger/10 border border-danger/20 mx-auto">
              <AlertTriangle className="w-7 h-7 text-danger" />
            </div>
            <div>
              <h2 className="font-cormorant text-2xl text-text-primary mb-2">Une erreur inattendue est survenue</h2>
              <p className="font-dm-sans text-sm text-text-secondary font-dm-mono">{this.state.error?.message || 'Erreur inconnue'}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => this.setState({ hasError: false, error: null })} className="btn-secondary flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4" /> Réessayer
              </button>
              <button onClick={() => { window.location.href = '/dashboard'; }} className="btn-primary text-sm">
                Tableau de bord
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
