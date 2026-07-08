import { Component } from 'react';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';
import BugReportModal from './BugReportModal';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showBugModal: false };
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
        <>
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
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="btn-ghost flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Réessayer
              </button>
              <button
                onClick={() => this.setState({ showBugModal: true })}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
                style={{
                  background: 'rgba(229,62,62,0.08)',
                  border: '0.5px solid rgba(229,62,62,0.28)',
                  color: '#e53e3e',
                  fontFamily: 'DM Sans, sans-serif',
                  cursor: 'pointer',
                }}
              >
                <Bug className="w-3.5 h-3.5" /> Signaler ce bug à DIPpro
              </button>
            </div>
          </div>
          <BugReportModal
            open={this.state.showBugModal}
            onClose={() => this.setState({ showBugModal: false })}
            errorInfo={this.state.error}
          />
        </>
      );
    }
    return this.props.children;
  }
}
