import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  FolderSync, CheckCircle, RefreshCw, Unlink, AlertTriangle,
  FileText, Clock, Zap, Info, FolderOpen, Play, Settings2,
  Laptop, Cloud, Smartphone, HardDrive
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Constants ──────────────────────────────────────────────────────────────

const FREQ_OPTIONS = [
  { value: '2_days',  label: 'Tous les 2 jours',    desc: 'Idéal si vos documents évoluent souvent' },
  { value: '3_days',  label: 'Tous les 3 jours',    desc: 'Bon équilibre réactivité / performance' },
  { value: '1_week',  label: 'Toutes les semaines', desc: 'Recommandé pour la plupart des franchiseurs' },
];

const MIME_LABELS = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.google-apps.document': 'Google Docs',
  'application/vnd.google-apps.spreadsheet': 'Google Sheets',
};

const STATUS_CFG = {
  new:     { label: 'Nouveau',  color: 'text-gold',    bg: 'bg-gold/10',    border: 'border-gold/20' },
  changed: { label: 'Modifié', color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
  ok:      { label: 'À jour',  color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
  error:   { label: 'Erreur',  color: 'text-danger',  bg: 'bg-danger/10',  border: 'border-danger/20' },
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// ── IndexedDB — persistance du FileSystemDirectoryHandle ──────────────────

const IDB_NAME = 'dippro-fs';
const IDB_STORE = 'handles';

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openIDB();
    return new Promise(resolve => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function idbSet(key, value) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDel(key) {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
  } catch { }
}

// ── File System API helpers ────────────────────────────────────────────────

async function scanDir(dirHandle, depth = 0, basePath = '') {
  const results = [];
  if (depth > 3) return results;
  for await (const [name, entry] of dirHandle.entries()) {
    if (name.startsWith('.')) continue;
    if (entry.kind === 'file') {
      const lower = name.toLowerCase();
      if (lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc')) {
        const file = await entry.getFile();
        if (file.size <= MAX_FILE_SIZE_BYTES) {
          results.push({ file, path: basePath ? `${basePath}/${name}` : name });
        }
      }
    } else if (entry.kind === 'directory' && depth < 3) {
      const sub = await scanDir(entry, depth + 1, basePath ? `${basePath}/${name}` : name);
      results.push(...sub);
    }
  }
  return results;
}

async function sha256(arrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.ok;
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

function MonitorConfig({ monitor, updateMutation }) {
  return (
    <div className="space-y-5 pt-4 mt-4 border-t border-border-subtle">
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <Clock className="w-3.5 h-3.5 text-gold" />
          <p className="font-dm-sans text-xs font-medium text-text-secondary">Fréquence de vérification</p>
        </div>
        <div className="space-y-1.5">
          {FREQ_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all"
              style={{
                borderColor: monitor.frequency === opt.value ? 'rgba(200,169,110,0.4)' : 'transparent',
                background: monitor.frequency === opt.value ? 'rgba(200,169,110,0.05)' : undefined,
              }}
            >
              <input
                type="radio"
                name={`freq-${monitor.id}`}
                value={opt.value}
                checked={monitor.frequency === opt.value}
                onChange={() => updateMutation.mutate({ id: monitor.id, frequency: opt.value })}
                className="sr-only"
              />
              <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${monitor.frequency === opt.value ? 'border-gold' : 'border-border-default'}`}>
                {monitor.frequency === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-gold" />}
              </div>
              <span className="font-dm-sans text-sm text-text-primary">{opt.label}</span>
              <span className="font-dm-sans text-xs text-text-muted">{opt.desc}</span>
            </label>
          ))}
        </div>
        {monitor.last_check_at && (
          <p className="font-dm-mono text-xs text-text-muted mt-2">
            Dernière vérif. : {new Date(monitor.last_check_at).toLocaleString('fr-FR')}
            {monitor.next_check_at && (
              <> · Prochaine : {new Date(monitor.next_check_at).toLocaleString('fr-FR')}</>
            )}
          </p>
        )}
      </div>

      <label className="flex items-center justify-between cursor-pointer">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-gold" />
          <div>
            <p className="font-dm-sans text-sm font-medium text-text-primary">Analyse IA automatique</p>
            <p className="font-dm-sans text-xs text-text-muted">Claude identifie les sections DIP impactées</p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={monitor.auto_analyze}
          onClick={() => updateMutation.mutate({ id: monitor.id, auto_analyze: !monitor.auto_analyze })}
          className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${monitor.auto_analyze ? 'bg-gold' : 'bg-bg-elevated border border-border-default'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${monitor.auto_analyze ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </label>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function MonitorPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showGoogleFolderPicker, setShowGoogleFolderPicker] = useState(false);
  const [showOneDriveFolderPicker, setShowOneDriveFolderPicker] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [connectingOneDrive, setConnectingOneDrive] = useState(false);
  const [scanningLocal, setScanningLocal] = useState(false);
  const [localHandle, setLocalHandle] = useState(null);
  const [localSupported, setLocalSupported] = useState(true);

  // Detect File System Access API support
  useEffect(() => {
    setLocalSupported('showDirectoryPicker' in window);
  }, []);

  // Restore local folder handle from IndexedDB on mount
  useEffect(() => {
    idbGet('local_folder').then(handle => {
      if (handle) setLocalHandle(handle);
    });
  }, []);

  // Handle OAuth redirect params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected === 'google') {
      toast.success('Google Drive connecté avec succès !');
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
      setSearchParams({});
    }
    if (connected === 'onedrive') {
      toast.success('OneDrive (Microsoft) connecté avec succès !');
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
      setSearchParams({});
    }
    if (error) {
      const msgs = {
        oauth_denied: 'Connexion annulée',
        invalid_session: 'Session expirée — reconnectez-vous',
        token_failed: 'Erreur d\'échange de token — réessayez',
        server_error: 'Erreur serveur — réessayez dans quelques instants',
      };
      toast.error(msgs[error] || 'Erreur de connexion');
      setSearchParams({});
    }
  }, [searchParams]);

  // ── Queries ──────────────────────────────────────────────────────────────

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

  const { data: googleFoldersData, refetch: refetchGoogleFolders, isFetching: loadingGoogleFolders } = useQuery({
    queryKey: ['monitor-google-folders'],
    queryFn: () => api.get('/monitor/google/folders').then(r => r.data),
    enabled: false,
    retry: false,
  });

  const { data: onedriveFoldersData, refetch: refetchOneDriveFolders, isFetching: loadingOneDriveFolders } = useQuery({
    queryKey: ['monitor-onedrive-folders'],
    queryFn: () => api.get('/monitor/onedrive/folders').then(r => r.data),
    enabled: false,
    retry: false,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }) => api.put(`/monitor/config/${id}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['monitor-config'] }),
    onError: (err) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: (source) => {
      if (source === 'google_drive') return api.delete('/monitor/google/disconnect');
      if (source === 'onedrive') return api.delete('/monitor/onedrive/disconnect');
      return Promise.resolve();
    },
    onSuccess: (_, source) => {
      const names = { google_drive: 'Google Drive', onedrive: 'OneDrive' };
      toast.success(`${names[source] || source} déconnecté`);
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
      queryClient.invalidateQueries({ queryKey: ['monitor-files'] });
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const res = await api.get('/monitor/google/auth');
      window.location.href = res.data.auth_url;
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      toast.error(msg.includes('GOOGLE_CLIENT_ID') ? 'Configurez GOOGLE_CLIENT_ID dans Vercel' : msg);
      setConnectingGoogle(false);
    }
  };

  const handleConnectOneDrive = async () => {
    setConnectingOneDrive(true);
    try {
      const res = await api.get('/monitor/onedrive/auth');
      window.location.href = res.data.auth_url;
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      toast.error(msg.includes('MICROSOFT_CLIENT_ID') ? 'Configurez MICROSOFT_CLIENT_ID dans Vercel' : msg);
      setConnectingOneDrive(false);
    }
  };

  const handleConnectLocal = async () => {
    if (!localSupported) {
      toast.error('Votre navigateur ne supporte pas cette fonctionnalité. Utilisez Chrome ou Edge.');
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      await idbSet('local_folder', handle);
      setLocalHandle(handle);
      toast.success(`Dossier "${handle.name}" connecté. Cliquez sur "Scanner" pour analyser vos fichiers.`);
    } catch (err) {
      if (err.name !== 'AbortError') toast.error('Accès au dossier refusé');
    }
  };

  const handleDisconnectLocal = async () => {
    if (!confirm('Déconnecter le dossier local ?')) return;
    try {
      await idbDel('local_folder');
      await api.delete('/monitor/local/disconnect');
      setLocalHandle(null);
      toast.success('Dossier local déconnecté');
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
      queryClient.invalidateQueries({ queryKey: ['monitor-files'] });
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleScanLocal = async () => {
    if (!localHandle) return;
    setScanningLocal(true);
    const toastId = toast.loading('Scan en cours…');
    try {
      const perm = await localHandle.requestPermission({ mode: 'read' });
      if (perm !== 'granted') {
        toast.dismiss(toastId);
        toast.error('Accès refusé — cliquez à nouveau pour réessayer');
        return;
      }

      const scanned = await scanDir(localHandle);
      if (scanned.length === 0) {
        toast.dismiss(toastId);
        toast('Aucun fichier PDF ou Word trouvé dans ce dossier', { icon: '📁' });
        return;
      }

      const filesData = [];
      for (const { file, path } of scanned) {
        const buffer = await file.arrayBuffer();
        const hash = await sha256(buffer);
        const content_base64 = toBase64(buffer);
        filesData.push({
          name: path,
          content_base64,
          mime_type: file.type || (path.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
          hash,
          last_modified: new Date(file.lastModified).toISOString(),
        });
      }

      toast.dismiss(toastId);
      const res = await api.post('/monitor/local/check', { folder_name: localHandle.name, files: filesData });
      const { changes, files_checked } = res.data;

      toast.success(
        changes > 0
          ? `${changes} modification(s) sur ${files_checked} fichier(s) analysé(s)`
          : `${files_checked} fichier(s) analysé(s) — aucun changement`
      );
      queryClient.invalidateQueries({ queryKey: ['monitor-files'] });
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
    } catch (err) {
      toast.dismiss(toastId);
      if (err.name === 'NotAllowedError') {
        toast.error('Accès refusé — veuillez autoriser l\'accès au dossier');
      } else {
        toast.error(err.response?.data?.error || err.message || 'Erreur lors du scan');
      }
    } finally {
      setScanningLocal(false);
    }
  };

  const handleCheckNow = async () => {
    setCheckingNow(true);
    try {
      const res = await api.post('/monitor/check-now');
      const { changes, files_checked } = res.data;
      toast.success(
        changes > 0
          ? `${changes} document(s) modifié(s) sur ${files_checked} analysé(s)`
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

  const handleSelectFolder = (source, folder) => {
    const monitor = source === 'google_drive' ? googleMonitor : onedriveMonitor;
    if (!monitor) return;
    updateMutation.mutate({ id: monitor.id, folder_id: folder.id, folder_name: folder.name });
    if (source === 'google_drive') setShowGoogleFolderPicker(false);
    else setShowOneDriveFolderPicker(false);
    toast.success(folder.id ? `Dossier "${folder.name}" sélectionné` : 'Surveillance de tout le stockage cloud activée');
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const monitors = configData?.monitors || [];
  const googleMonitor = monitors.find(m => m.source === 'google_drive');
  const onedriveMonitor = monitors.find(m => m.source === 'onedrive');
  const localMonitor = monitors.find(m => m.source === 'local_folder');
  const files = filesData?.files || [];
  const changedFiles = files.filter(f => f.status === 'new' || f.status === 'changed');
  const anyConnected = googleMonitor || onedriveMonitor || localHandle;

  if (isLoading) return <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="Surveillance documentaire"
        subtitle="Connectez vos sources de documents pour que DIPpro détecte automatiquement les modifications impactant votre DIP"
        action={
          anyConnected && (
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

      {/* ── Google Drive ─────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${googleMonitor ? 'bg-success/10 border-success/20' : 'bg-bg-elevated border-border-subtle'}`}>
              <Cloud className={`w-5 h-5 ${googleMonitor ? 'text-success' : 'text-text-secondary'}`} />
            </div>
            <div>
              <p className="font-dm-sans text-sm font-medium text-text-primary">Google Drive</p>
              <p className="font-dm-mono text-xs text-text-secondary mt-0.5">
                {googleMonitor ? `Connecté : ${googleMonitor.drive_email || 'compte Google'}` : 'Non connecté — Mac, Windows, iOS, Android'}
              </p>
            </div>
          </div>
          {googleMonitor ? (
            <div className="flex items-center gap-3">
              <span className="font-dm-mono text-xs text-success flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Actif</span>
              <button
                onClick={() => { if (confirm('Déconnecter Google Drive ?')) disconnectMutation.mutate('google_drive'); }}
                disabled={disconnectMutation.isPending}
                className="btn-ghost text-xs flex items-center gap-1.5 text-danger hover:text-danger/80"
              >
                <Unlink className="w-3.5 h-3.5" /> Déconnecter
              </button>
            </div>
          ) : (
            <button onClick={handleConnectGoogle} disabled={connectingGoogle} className="btn-liquid-glass-prominent flex items-center gap-2 text-sm">
              {connectingGoogle ? <LoadingSpinner size="sm" /> : <Cloud className="w-4 h-4" />}
              Connecter
            </button>
          )}
        </div>

        {googleMonitor ? (
          <>
            {/* Folder picker */}
            <div className="flex items-center justify-between bg-bg-elevated rounded-lg px-4 py-2.5 mb-3">
              <div>
                <p className="font-dm-sans text-sm text-text-primary">{googleMonitor.folder_name || 'Tout Mon Drive'}</p>
                <p className="font-dm-mono text-xs text-text-muted mt-0.5">
                  {googleMonitor.folder_id ? `ID: ${googleMonitor.folder_id}` : 'Tous les fichiers compatibles'}
                </p>
              </div>
              <button
                onClick={() => { setShowGoogleFolderPicker(v => !v); refetchGoogleFolders(); }}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Settings2 className="w-3.5 h-3.5" /> Changer
              </button>
            </div>

            {showGoogleFolderPicker && (
              <div className="border border-border-default rounded-xl overflow-hidden mb-3">
                {loadingGoogleFolders ? (
                  <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-border-subtle">
                    {(googleFoldersData?.folders || []).map(folder => (
                      <button
                        key={folder.id || 'root'}
                        onClick={() => handleSelectFolder('google_drive', folder)}
                        className={`w-full text-left px-4 py-2.5 hover:bg-bg-elevated transition-colors flex items-center gap-3 ${googleMonitor.folder_id === folder.id ? 'bg-gold/5' : ''}`}
                      >
                        <FolderOpen className="w-4 h-4 text-gold flex-shrink-0" />
                        <span className="font-dm-sans text-sm text-text-primary">{folder.name}</span>
                        {googleMonitor.folder_id === folder.id && <CheckCircle className="w-3.5 h-3.5 text-success ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <MonitorConfig monitor={googleMonitor} updateMutation={updateMutation} />
          </>
        ) : (
          <InfoBox>
            DIPpro surveille votre Google Drive et détecte les modifications (bilans INPI, contrats, actes...) pouvant nécessiter une mise à jour de votre DIP.
            Accès en lecture seule — aucune donnée Drive n'est modifiée.
          </InfoBox>
        )}
      </div>

      {/* ── Dossier local — Mac & Windows ────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${localHandle ? 'bg-success/10 border-success/20' : 'bg-bg-elevated border-border-subtle'}`}>
              <Laptop className={`w-5 h-5 ${localHandle ? 'text-success' : 'text-text-secondary'}`} />
            </div>
            <div>
              <p className="font-dm-sans text-sm font-medium text-text-primary">Dossier local</p>
              <p className="font-dm-mono text-xs text-text-secondary mt-0.5">
                {localHandle
                  ? `Connecté : ${localHandle.name}`
                  : localSupported
                    ? 'Non connecté — Mac & Windows (Chrome / Edge)'
                    : 'Navigateur non compatible — utilisez Chrome ou Edge'}
              </p>
            </div>
          </div>
          {localHandle ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleScanLocal}
                disabled={scanningLocal}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                {scanningLocal ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Scanner
              </button>
              <button
                onClick={handleDisconnectLocal}
                className="btn-ghost text-xs flex items-center gap-1.5 text-danger hover:text-danger/80"
              >
                <Unlink className="w-3.5 h-3.5" /> Déconnecter
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectLocal}
              disabled={!localSupported}
              className="btn-liquid-glass-prominent flex items-center gap-2 text-sm disabled:opacity-40"
            >
              <HardDrive className="w-4 h-4" />
              Connecter
            </button>
          )}
        </div>

        {localHandle && localMonitor && (
          <MonitorConfig monitor={localMonitor} updateMutation={updateMutation} />
        )}

        {!localHandle && (
          <InfoBox>
            Donnez accès à un dossier de votre Mac ou PC. DIPpro lit vos PDF et Word en local et analyse les changements — vos fichiers ne quittent jamais votre appareil sans votre consentement.
            {!localSupported && ' ⚠️ Firefox et Safari ne supportent pas encore cette API. Utilisez Chrome ou Edge.'}
          </InfoBox>
        )}

        {localHandle && (
          <div className="mt-3 flex items-start gap-3 rounded-xl p-3 bg-bg-elevated border border-border-subtle">
            <Info className="w-3.5 h-3.5 text-gold flex-shrink-0 mt-0.5" />
            <p className="font-dm-sans text-xs text-text-muted">
              Cliquez sur <strong className="text-text-secondary">Scanner</strong> pour analyser le dossier. L'accès est réinitialisé à chaque session — votre navigateur peut redemander la permission.
            </p>
          </div>
        )}
      </div>

      {/* ── OneDrive (Microsoft) ──────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${onedriveMonitor ? 'bg-success/10 border-success/20' : 'bg-bg-elevated border-border-subtle'}`}>
              <FolderSync className={`w-5 h-5 ${onedriveMonitor ? 'text-success' : 'text-text-secondary'}`} />
            </div>
            <div>
              <p className="font-dm-sans text-sm font-medium text-text-primary">OneDrive <span className="font-dm-mono text-xs text-text-muted ml-1">Microsoft</span></p>
              <p className="font-dm-mono text-xs text-text-secondary mt-0.5">
                {onedriveMonitor ? `Connecté : ${onedriveMonitor.drive_email || 'compte Microsoft'}` : 'Non connecté — Windows, Mac, SharePoint'}
              </p>
            </div>
          </div>
          {onedriveMonitor ? (
            <div className="flex items-center gap-3">
              <span className="font-dm-mono text-xs text-success flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Actif</span>
              <button
                onClick={() => { if (confirm('Déconnecter OneDrive ?')) disconnectMutation.mutate('onedrive'); }}
                disabled={disconnectMutation.isPending}
                className="btn-ghost text-xs flex items-center gap-1.5 text-danger hover:text-danger/80"
              >
                <Unlink className="w-3.5 h-3.5" /> Déconnecter
              </button>
            </div>
          ) : (
            <button onClick={handleConnectOneDrive} disabled={connectingOneDrive} className="btn-liquid-glass-prominent flex items-center gap-2 text-sm">
              {connectingOneDrive ? <LoadingSpinner size="sm" /> : <FolderSync className="w-4 h-4" />}
              Connecter
            </button>
          )}
        </div>

        {onedriveMonitor ? (
          <>
            <div className="flex items-center justify-between bg-bg-elevated rounded-lg px-4 py-2.5 mb-3">
              <div>
                <p className="font-dm-sans text-sm text-text-primary">{onedriveMonitor.folder_name || 'Tout Mon OneDrive'}</p>
                <p className="font-dm-mono text-xs text-text-muted mt-0.5">
                  {onedriveMonitor.folder_id ? `ID: ${onedriveMonitor.folder_id}` : 'Tous les dossiers compatibles'}
                </p>
              </div>
              <button
                onClick={() => { setShowOneDriveFolderPicker(v => !v); refetchOneDriveFolders(); }}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Settings2 className="w-3.5 h-3.5" /> Changer
              </button>
            </div>

            {showOneDriveFolderPicker && (
              <div className="border border-border-default rounded-xl overflow-hidden mb-3">
                {loadingOneDriveFolders ? (
                  <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-border-subtle">
                    {(onedriveFoldersData?.folders || []).map(folder => (
                      <button
                        key={folder.id || 'root'}
                        onClick={() => handleSelectFolder('onedrive', folder)}
                        className={`w-full text-left px-4 py-2.5 hover:bg-bg-elevated transition-colors flex items-center gap-3 ${onedriveMonitor.folder_id === folder.id ? 'bg-gold/5' : ''}`}
                      >
                        <FolderOpen className="w-4 h-4 text-gold flex-shrink-0" />
                        <span className="font-dm-sans text-sm text-text-primary">{folder.name}</span>
                        {onedriveMonitor.folder_id === folder.id && <CheckCircle className="w-3.5 h-3.5 text-success ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <MonitorConfig monitor={onedriveMonitor} updateMutation={updateMutation} />
          </>
        ) : (
          <InfoBox>
            Connectez votre OneDrive personnel ou professionnel (Microsoft 365 / SharePoint). DIPpro surveille vos fichiers Word, Excel et PDF — accès en lecture seule.
          </InfoBox>
        )}
      </div>

      {/* ── Samsung ───────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-bg-elevated border-border-subtle">
            <Smartphone className="w-5 h-5 text-text-secondary" />
          </div>
          <div>
            <p className="font-dm-sans text-sm font-medium text-text-primary">Samsung <span className="font-dm-mono text-xs text-text-muted ml-1">Galaxy / Android</span></p>
            <p className="font-dm-mono text-xs text-text-secondary mt-0.5">Synchronisation via Google Drive ou OneDrive</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl p-4 bg-bg-elevated border border-border-subtle">
          <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
          <div className="font-dm-sans text-xs text-text-secondary space-y-2">
            <p>
              Les appareils Samsung Galaxy synchronisent automatiquement les fichiers via <strong className="text-text-primary">Google Drive</strong> (My Files) ou <strong className="text-text-primary">OneDrive</strong> (Microsoft 365 for Business).
            </p>
            <p>
              <strong className="text-text-primary">Comment configurer :</strong>
            </p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Sur votre Samsung : Paramètres → Comptes → Google → activez la synchronisation Drive</li>
              <li>Dans DIPpro : connectez Google Drive (ci-dessus) et sélectionnez le dossier "Mes documents"</li>
              <li>DIPpro détectera automatiquement les nouveaux fichiers synchronisés depuis votre Galaxy</li>
            </ol>
          </div>
        </div>
      </div>

      {/* ── Fichiers détectés ─────────────────────────────────────────────── */}
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
            <p className="font-dm-sans text-sm text-text-secondary mb-1">Aucun fichier détecté pour l'instant</p>
            <p className="font-dm-sans text-xs text-text-muted">
              Connectez une source et cliquez sur « Vérifier maintenant » ou « Scanner »
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
                        {file.last_modified
                          ? new Date(file.last_modified).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={file.status} />
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {file.change_summary
                          ? <p className="font-dm-sans text-xs text-text-secondary line-clamp-2">{file.change_summary}</p>
                          : <span className="font-dm-mono text-xs text-text-muted">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Guide de configuration (si rien n'est connecté) ──────────────── */}
      {!anyConnected && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-gold" />
            <p className="font-dm-sans text-sm font-medium text-text-primary">Variables d'environnement à configurer</p>
          </div>
          <p className="font-dm-sans text-xs text-text-secondary">
            Pour activer Google Drive ou OneDrive, ajoutez ces variables dans <strong className="text-text-primary">Vercel → Settings → Environment Variables</strong> :
          </p>
          {[
            { key: 'GOOGLE_CLIENT_ID', desc: 'OAuth Client ID Google (Google Cloud Console → APIs → Credentials)' },
            { key: 'GOOGLE_CLIENT_SECRET', desc: 'OAuth Client Secret Google' },
            { key: 'MICROSOFT_CLIENT_ID', desc: 'Application (client) ID Azure (portail.azure.com → App registrations)' },
            { key: 'MICROSOFT_CLIENT_SECRET', desc: 'Secret client Azure AD' },
            { key: 'BACKEND_URL', desc: 'URL de votre API (ex: https://dippro.business)' },
            { key: 'MONITOR_CRON_SECRET', desc: 'Secret pour sécuriser l\'endpoint cron' },
            { key: 'MONITOR_ENCRYPTION_KEY', desc: 'Clé 64 hex chars — générez avec: openssl rand -hex 32' },
          ].map(({ key, desc }) => (
            <div key={key} className="bg-bg-elevated rounded-lg px-4 py-3">
              <p className="font-dm-mono text-xs text-gold mb-1">{key}</p>
              <p className="font-dm-sans text-xs text-text-secondary">{desc}</p>
            </div>
          ))}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gold/5 border border-gold/15">
            <AlertTriangle className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
            <div className="font-dm-sans text-xs text-text-secondary space-y-1">
              <p><strong className="text-text-primary">URIs de redirection OAuth à configurer :</strong></p>
              <p className="font-dm-mono text-gold break-all">https://votre-domaine.vercel.app/api/monitor/google/callback</p>
              <p className="font-dm-mono text-gold break-all">https://votre-domaine.vercel.app/api/monitor/onedrive/callback</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
