import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  FolderSync, CheckCircle, XCircle, RefreshCw, Unlink,
  ChevronDown, AlertTriangle, FileText, Clock, Zap, Info,
  FolderOpen, Play, Settings2
} from 'lucide-react';
import toast from 'react-hot-toast';

const FREQ_OPTIONS = [
  { value: '2_days',  label: 'Tous les 2 jours',   desc: 'Mise à jour fréquente — idéal si vos documents évoluent souvent' },
  { value: '3_days',  label: 'Tous les 3 jours',   desc: 'Bon équilibre entre réactivité et performance' },
  { value: '1_week',  label: 'Toutes les semaines', desc: 'Recommandé pour la plupart des franchiseurs' },
];

const MIME_LABELS = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.google-apps.document': 'Google Docs',
  'application/vnd.google-apps.spreadsheet': 'Google Sheets',
};

const STATUS_CONFIG = {
  new:     { label: 'Nouveau',   color: 'text-gold',    bg: 'bg-gold/10',    border: 'border-gold/20' },
  changed: { label: 'Modifié',   color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
  ok:      { label: 'À jour',    color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
  error:   { label: 'Erreur',    color: 'text-danger',  bg: 'bg-danger/10',  border: 'border-danger/20' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ok;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded font-dm-mono text-xs border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function InfoBox({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl p-4 bg-gold/5 border border-gold/15">
      <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
      <p className="font-dm-sans text-xs text-text-secondary leading-relaxed">{children}</p>
    </div>
  );
}

export default function MonitorPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  // Handle OAuth redirect params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected === 'google') {
      toast.success('Google Drive connecté avec succès !');
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
      setSearchParams({});
    }
    if (error) {
      const messages = {
        oauth_denied: 'Connexion Google annulée',
        invalid_session: 'Session expirée — reconnectez-vous',
        token_failed: 'Erreur d\'échange de token — réessayez',
        server_error: 'Erreur serveur — réessayez dans quelques instants',
      };
      toast.error(messages[error] || 'Erreur de connexion Google Drive');
      setSearchParams({});
    }
  }, [searchParams]);

  const { data: configData, isLoading } = useQuery({
    queryKey: ['monitor-config'],
    queryFn: () => api.get('/monitor/config').then(r => r.data),
    retry: false,
  });

  const { data: filesData } = useQuery({
    queryKey: ['monitor-files'],
    queryFn: () => api.get('/monitor/files').then(r => r.data),
    retry: false,
  });

  const { data: foldersData, refetch: refetchFolders, isFetching: loadingFolders } = useQuery({
    queryKey: ['monitor-folders'],
    queryFn: () => api.get('/monitor/google/folders').then(r => r.data),
    enabled: false,
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }) => api.put(`/monitor/config/${id}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['monitor-config'] }),
    onError: (err) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete('/monitor/google/disconnect'),
    onSuccess: () => {
      toast.success('Google Drive déconnecté');
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
      queryClient.invalidateQueries({ queryKey: ['monitor-files'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const res = await api.get('/monitor/google/auth');
      window.location.href = res.data.auth_url;
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      if (msg.includes('GOOGLE_CLIENT_ID')) {
        toast.error('Configurez GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET dans Vercel');
      } else {
        toast.error(msg);
      }
      setConnectingGoogle(false);
    }
  };

  const handleCheckNow = async () => {
    setCheckingNow(true);
    try {
      const res = await api.post('/monitor/check-now');
      const { changes, files_checked } = res.data;
      toast.success(
        changes > 0
          ? `${changes} document(s) modifié(s) détecté(s) sur ${files_checked} analysé(s)`
          : `${files_checked} document(s) analysé(s) — aucun changement`
      );
      queryClient.invalidateQueries({ queryKey: ['monitor-files'] });
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setCheckingNow(false);
    }
  };

  const handleSelectFolder = (folder) => {
    if (!monitor) return;
    updateMutation.mutate({ id: monitor.id, folder_id: folder.id, folder_name: folder.name });
    setShowFolderPicker(false);
    toast.success(folder.id ? `Dossier "${folder.name}" sélectionné` : 'Surveillance de tout le Drive activée');
  };

  const monitor = configData?.monitors?.find(m => m.source === 'google_drive');
  const files = filesData?.files || [];
  const changedFiles = files.filter(f => f.status === 'new' || f.status === 'changed');

  if (isLoading) return <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="Surveillance documentaire"
        subtitle="Connectez votre Drive pour que DIPpro détecte automatiquement les documents impactant votre DIP"
        action={
          monitor?.enabled && (
            <button
              onClick={handleCheckNow}
              disabled={checkingNow}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {checkingNow ? <LoadingSpinner size="sm" /> : <Play className="w-4 h-4" />}
              Vérifier maintenant
            </button>
          )
        }
      />

      {/* ── Statut connexion ────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${monitor ? 'bg-success/10 border-success/20' : 'bg-bg-elevated border-border-subtle'}`}>
              <FolderSync className={`w-5 h-5 ${monitor ? 'text-success' : 'text-text-secondary'}`} />
            </div>
            <div>
              <p className="font-dm-sans text-sm font-medium text-text-primary">Google Drive</p>
              <p className="font-dm-mono text-xs text-text-secondary mt-0.5">
                {monitor ? `Connecté : ${monitor.drive_email || 'compte Google'}` : 'Non connecté'}
              </p>
            </div>
          </div>
          {monitor ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 font-dm-mono text-xs text-success">
                <CheckCircle className="w-3.5 h-3.5" /> Actif
              </div>
              <button
                onClick={() => { if (confirm('Déconnecter Google Drive ?')) disconnectMutation.mutate(); }}
                disabled={disconnectMutation.isPending}
                className="btn-ghost text-xs flex items-center gap-1.5 text-danger hover:text-danger/80"
              >
                <Unlink className="w-3.5 h-3.5" /> Déconnecter
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              disabled={connectingGoogle}
              className="btn-liquid-glass-prominent flex items-center gap-2 text-sm"
            >
              {connectingGoogle ? <LoadingSpinner size="sm" /> : <FolderSync className="w-4 h-4" />}
              Connecter Google Drive
            </button>
          )}
        </div>

        {!monitor && (
          <InfoBox>
            DIPpro surveille votre Google Drive et détecte automatiquement les nouveaux documents ou les modifications (bilans, actes INPI, contrats...) qui pourraient nécessiter une mise à jour de votre DIP.
            Aucune donnée n'est modifiée dans votre Drive — accès en lecture seule.
          </InfoBox>
        )}
      </div>

      {/* ── Configuration (si connecté) ─────────────────────────────────── */}
      {monitor && (
        <>
          {/* Dossier surveillé */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <FolderOpen className="w-4 h-4 text-gold" />
              <p className="font-dm-sans text-sm font-medium text-text-primary">Dossier surveillé</p>
            </div>

            <div className="flex items-center justify-between bg-bg-elevated rounded-lg px-4 py-3">
              <div>
                <p className="font-dm-sans text-sm text-text-primary">
                  {monitor.folder_name || 'Tout Mon Drive'}
                </p>
                <p className="font-dm-mono text-xs text-text-secondary mt-0.5">
                  {monitor.folder_id ? `ID: ${monitor.folder_id}` : 'Tous les dossiers et fichiers compatibles'}
                </p>
              </div>
              <button
                onClick={() => { setShowFolderPicker(v => !v); refetchFolders(); }}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Changer
              </button>
            </div>

            {showFolderPicker && (
              <div className="border border-border-default rounded-xl overflow-hidden animate-slide-up">
                {loadingFolders ? (
                  <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
                ) : (
                  <div className="max-h-56 overflow-y-auto divide-y divide-border-subtle">
                    {(foldersData?.folders || []).map(folder => (
                      <button
                        key={folder.id || 'root'}
                        onClick={() => handleSelectFolder(folder)}
                        className={`w-full text-left px-4 py-3 hover:bg-bg-elevated transition-colors flex items-center gap-3 ${
                          monitor.folder_id === folder.id ? 'bg-gold/5' : ''
                        }`}
                      >
                        <FolderOpen className="w-4 h-4 text-gold flex-shrink-0" />
                        <span className="font-dm-sans text-sm text-text-primary">{folder.name}</span>
                        {monitor.folder_id === folder.id && (
                          <CheckCircle className="w-3.5 h-3.5 text-success ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <InfoBox>
              Types de fichiers surveillés : PDF, Word (.docx), Excel (.xlsx), Google Docs, Google Sheets.
              DIPpro télécharge et analyse uniquement les fichiers modifiés depuis la dernière vérification.
            </InfoBox>
          </div>

          {/* Fréquence */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-gold" />
              <p className="font-dm-sans text-sm font-medium text-text-primary">Fréquence de vérification</p>
            </div>

            <div className="space-y-2">
              {FREQ_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-gold/30" style={{
                  borderColor: monitor.frequency === opt.value ? 'rgba(200,169,110,0.4)' : undefined,
                  background: monitor.frequency === opt.value ? 'rgba(200,169,110,0.05)' : undefined,
                }}>
                  <input
                    type="radio"
                    name="frequency"
                    value={opt.value}
                    checked={monitor.frequency === opt.value}
                    onChange={() => updateMutation.mutate({ id: monitor.id, frequency: opt.value })}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                    monitor.frequency === opt.value ? 'border-gold' : 'border-border-default'
                  }`}>
                    {monitor.frequency === opt.value && <div className="w-2 h-2 rounded-full bg-gold" />}
                  </div>
                  <div>
                    <p className="font-dm-sans text-sm font-medium text-text-primary">{opt.label}</p>
                    <p className="font-dm-sans text-xs text-text-secondary mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {monitor.last_check_at && (
              <div className="flex items-center gap-2 font-dm-mono text-xs text-text-secondary">
                <RefreshCw className="w-3.5 h-3.5" />
                Dernière vérification : {new Date(monitor.last_check_at).toLocaleString('fr-FR')}
                {monitor.next_check_at && (
                  <span className="text-text-muted">
                    · Prochaine : {new Date(monitor.next_check_at).toLocaleString('fr-FR')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Analyse IA automatique */}
          <div className="card">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-gold" />
                <div>
                  <p className="font-dm-sans text-sm font-medium text-text-primary">Analyse IA automatique</p>
                  <p className="font-dm-sans text-xs text-text-secondary mt-0.5">
                    Claude analyse les changements et identifie les sections DIP impactées
                  </p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={monitor.auto_analyze}
                onClick={() => updateMutation.mutate({ id: monitor.id, auto_analyze: !monitor.auto_analyze })}
                className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${
                  monitor.auto_analyze ? 'bg-gold' : 'bg-bg-elevated border border-border-default'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  monitor.auto_analyze ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </label>
          </div>

          {/* ── Fichiers surveillés ──────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-cormorant text-xl text-text-primary">
                Fichiers détectés
                {files.length > 0 && <span className="font-dm-mono text-sm text-text-secondary ml-2">({files.length})</span>}
              </h2>
              {changedFiles.length > 0 && (
                <span className="font-dm-mono text-xs px-2 py-1 rounded bg-warning/10 text-warning border border-warning/20">
                  {changedFiles.length} modification(s) à examiner
                </span>
              )}
            </div>

            {files.length === 0 ? (
              <div className="card text-center py-12">
                <FileText className="w-10 h-10 text-text-muted mx-auto mb-4" />
                <p className="font-dm-sans text-sm text-text-secondary mb-2">
                  Aucun fichier détecté pour l'instant
                </p>
                <p className="font-dm-sans text-xs text-text-muted">
                  Cliquez sur « Vérifier maintenant » pour lancer une première analyse
                </p>
              </div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-subtle">
                        {['Fichier', 'Type', 'Modifié le', 'Statut', 'Analyse IA'].map((h, i) => (
                          <th key={i} className="text-left px-4 py-3 font-dm-mono text-xs text-text-secondary whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((file, i) => (
                        <tr key={file.id} className={`border-b border-border-subtle hover:bg-bg-elevated transition-colors ${i === files.length - 1 ? 'border-0' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="font-dm-sans text-sm text-text-primary font-medium truncate max-w-[180px]">{file.file_name}</p>
                          </td>
                          <td className="px-4 py-3 font-dm-mono text-xs text-text-secondary whitespace-nowrap">
                            {MIME_LABELS[file.mime_type] || 'Document'}
                          </td>
                          <td className="px-4 py-3 font-dm-mono text-xs text-text-secondary whitespace-nowrap">
                            {file.last_modified ? new Date(file.last_modified).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={file.status} />
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            {file.change_summary ? (
                              <p className="font-dm-sans text-xs text-text-secondary line-clamp-2">{file.change_summary}</p>
                            ) : (
                              <span className="font-dm-mono text-xs text-text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Guide de configuration Google Drive (si pas connecté) ────── */}
      {!monitor && (
        <div className="card space-y-5">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-gold" />
            <p className="font-dm-sans text-sm font-medium text-text-primary">Configuration requise — Google Cloud Console</p>
          </div>
          <p className="font-dm-sans text-xs text-text-secondary">
            Pour activer Google Drive, ajoutez ces variables dans <strong className="text-text-primary">Vercel → Settings → Environment Variables</strong> :
          </p>
          {[
            { key: 'GOOGLE_CLIENT_ID', desc: 'OAuth Client ID (Google Cloud Console → APIs → Credentials)' },
            { key: 'GOOGLE_CLIENT_SECRET', desc: 'OAuth Client Secret' },
            { key: 'BACKEND_URL', desc: 'URL de votre API (ex: https://dippro.business)' },
            { key: 'MONITOR_CRON_SECRET', desc: 'Secret pour sécuriser l\'endpoint cron (chaîne aléatoire)' },
            { key: 'MONITOR_ENCRYPTION_KEY', desc: 'Clé de chiffrement 64 hex chars (générez avec: openssl rand -hex 32)' },
          ].map(({ key, desc }) => (
            <div key={key} className="bg-bg-elevated rounded-lg px-4 py-3">
              <p className="font-dm-mono text-xs text-gold mb-1">{key}</p>
              <p className="font-dm-sans text-xs text-text-secondary">{desc}</p>
            </div>
          ))}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gold/5 border border-gold/15">
            <AlertTriangle className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
            <div className="font-dm-sans text-xs text-text-secondary space-y-1">
              <p><strong className="text-text-primary">URI de redirection OAuth à configurer dans Google Cloud :</strong></p>
              <p className="font-dm-mono text-gold">https://votre-domaine.vercel.app/api/monitor/google/callback</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
