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
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-64 gap-5 p-8 text-center">
          <div className="w-14 h-14 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-danger" />
          </div>
          <div>
            <p className="font-cormorant text-2xl text-text-primary mb-2">Une erreur s'est produite</p>
            <p className="font-dm-sans text-sm text-text-secondary max-w-sm">
              {this.state.error?.message || 'Erreur inattendue. Rechargez la page pour continuer.'}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-ghost flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
