import { Component } from 'react';
import { AlertTriangle, RefreshCw, Bug, Copy, Check } from 'lucide-react';
import BugReportModal from './BugReportModal';
import { logError } from '../lib/errorJournal';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, showBugModal: false, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const componentStack = info?.componentStack || null;
    this.setState({ componentStack });

    // Journalise + envoie automatiquement au backend (email admin + BDD)
    logError(error, { type: 'react-render', componentStack });

    // ChunkLoadError après un déploiement Vercel : rechargement automatique.
    // La clé est propre à chaque route (pas un seul flag global pour toute la
    // session) — sinon un chunk périmé rencontré sur une page consommait la
    // seule tentative disponible, laissant toute autre page qui rencontre le
    // même souci ensuite bloquée sans recharger (ex: /admin resté figé après
    // qu'une autre page ait déjà déclenché le rechargement automatique).
    const isChunkError = error?.name === 'ChunkLoadError'
      || error?.message?.includes('Failed to fetch dynamically imported module')
      || error?.message?.includes('Loading chunk')
      || error?.message?.includes('Importing a module script failed')
      || error?.message?.includes('error loading dynamically imported module');
    const reloadKey = `chunk-reload:${window.location.pathname}`;
    if (isChunkError && !sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, '1');
      window.location.reload();
    }
  }

  copyDetails = () => {
    const { error, componentStack } = this.state;
    const details = [
      `Message : ${error?.message || 'N/A'}`,
      `Type : ${error?.name || 'Error'}`,
      `Page : ${window.location.href}`,
      `Date : ${new Date().toISOString()}`,
      '',
      '--- Stack ---',
      error?.stack || 'N/A',
      componentStack ? '\n--- Composant ---' + componentStack : '',
    ].join('\n');
    navigator.clipboard?.writeText(details).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, componentStack, copied } = this.state;
      return (
        <>
          <div className="flex flex-col items-center justify-center min-h-64 gap-5 p-8 text-center">
            <div className="w-14 h-14 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-danger" />
            </div>
            <div>
              <p className="font-cormorant text-2xl text-text-primary mb-2">Une erreur s'est produite</p>
              <p className="font-dm-sans text-sm text-text-secondary max-w-sm">
                {error?.message || 'Erreur inattendue. Rechargez la page pour continuer.'}
              </p>
            </div>

            {/* Détail technique — permet de diagnostiquer précisément le crash */}
            <details className="w-full max-w-lg text-left">
              <summary className="font-dm-mono text-xs text-text-muted cursor-pointer select-none hover:text-text-secondary transition-colors">
                Détails techniques
              </summary>
              <pre className="mt-2 p-3 rounded-lg bg-bg-elevated border border-border-subtle font-dm-mono text-[11px] leading-relaxed text-text-secondary overflow-auto max-h-64 whitespace-pre-wrap break-words">
{error?.name ? `${error.name}: ` : ''}{error?.message || 'Erreur inconnue'}
{error?.stack ? '\n\n' + error.stack : ''}
{componentStack ? '\n' + componentStack : ''}
              </pre>
              <button
                onClick={this.copyDetails}
                className="btn-ghost flex items-center gap-2 text-xs mt-2"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copié !' : 'Copier les détails'}
              </button>
            </details>

            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Recharger la page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null, componentStack: null })}
                className="btn-ghost flex items-center gap-2"
              >
                Réessayer
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
