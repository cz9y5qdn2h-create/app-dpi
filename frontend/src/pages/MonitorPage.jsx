import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  CheckCircle, Unlink, AlertTriangle, FileText, Clock, Zap,
  Info, FolderOpen, Play, Settings2, Laptop, Cloud, Smartphone,
  FolderSync, HardDrive, Upload, Trash2, RefreshCw, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Constantes ─────────────────────────────────────────────────────────────

const FREQ_OPTIONS = [
  { value: '2_days', label: 'Tous les 2 jours',    desc: 'Documents très actifs' },
  { value: '3_days', label: 'Tous les 3 jours',    desc: 'Recommandé' },
  { value: '1_week', label: 'Toutes les semaines', desc: 'Documents stables' },
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

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 Mo

// ── IndexedDB — persistence du FileSystemDirectoryHandle ──────────────────

async function idbOp(mode, key, value) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('dippro-fs', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('handles', mode);
      const store = tx.objectStore('handles');
      const op = mode === 'readwrite'
        ? (value !== undefined ? store.put(value, key) : store.delete(key))
        : store.get(key);
      op.onsuccess = () => resolve(op.result ?? null);
      op.onerror = () => reject(op.error);
    };
  });
}

const idbGet = (k) => idbOp('readonly', k).catch(() => null);
const idbSet = (k, v) => idbOp('readwrite', k, v).catch(() => {});
const idbDel = (k) => idbOp('readwrite', k).catch(() => {});

// ── Helpers fichiers ───────────────────────────────────────────────────────

async function sha256hex(arrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

function isSupported(name) {
  const l = name.toLowerCase();
  return l.endsWith('.pdf') || l.endsWith('.docx') || l.endsWith('.doc') || l.endsWith('.xlsx');
}

async function scanDirHandle(dirHandle, depth = 0, base = '') {
  const out = [];
  if (depth > 3) return out;
  for await (const [name, entry] of dirHandle.entries()) {
    if (name.startsWith('.')) continue;
    if (entry.kind === 'file' && isSupported(name)) {
      const file = await entry.getFile();
      if (file.size <= MAX_FILE_BYTES) out.push({ file, path: base ? `${base}/${name}` : name });
    } else if (entry.kind === 'directory' && depth < 3) {
      out.push(...await scanDirHandle(entry, depth + 1, base ? `${base}/${name}` : name));
    }
  }
  return out;
}

// Extrait les fichiers d'un drop (supporte les dossiers entiers)
async function extractDroppedFiles(dataTransferItems) {
  const out = [];
  async function traverse(entry, base = '') {
    if (entry.isFile) {
      if (!isSupported(entry.name)) return;
      const file = await new Promise(r => entry.file(r));
      if (file.size <= MAX_FILE_BYTES) out.push({ file, path: base ? `${base}/${entry.name}` : entry.name });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let entries = [];
      await new Promise(r => reader.readEntries(e => { entries = e; r(); }));
      for (const sub of entries) await traverse(sub, base ? `${base}/${entry.name}` : entry.name);
    }
  }
  for (const item of dataTransferItems) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) await traverse(entry);
    else {
      const file = item.getAsFile?.();
      if (file && isSupported(file.name) && file.size <= MAX_FILE_BYTES)
        out.push({ file, path: file.name });
    }
  }
  return out;
}

// ── Sous-composants ────────────────────────────────────────────────────────

function Badge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.ok;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded font-dm-mono text-xs border ${c.bg} ${c.color} ${c.border}`}>
      {c.label}
    </span>
  );
}

function Tip({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl p-3.5 bg-gold/5 border border-gold/15">
      <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
      <p className="font-dm-sans text-xs text-text-secondary leading-relaxed">{children}</p>
    </div>
  );
}

function FreqConfig({ monitor, updateMutation }) {
  return (
    <div className="space-y-4 pt-4 mt-4 border-t border-border-subtle">
      <div>
        <p className="font-dm-sans text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Fréquence
        </p>
        <div className="space-y-1.5">
          {FREQ_OPTIONS.map(o => (
            <label key={o.value}
              className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all"
              style={{
                background: monitor.frequency === o.value ? 'rgba(200,169,110,0.06)' : undefined,
                border: `1px solid ${monitor.frequency === o.value ? 'rgba(200,169,110,0.35)' : 'transparent'}`,
              }}
            >
              <input type="radio" name={`f-${monitor.id}`} className="sr-only"
                checked={monitor.frequency === o.value}
                onChange={() => updateMutation.mutate({ id: monitor.id, frequency: o.value })} />
              <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${monitor.frequency === o.value ? 'border-gold' : 'border-border-default'}`}>
                {monitor.frequency === o.value && <div className="w-1.5 h-1.5 rounded-full bg-gold" />}
              </div>
              <span className="font-dm-sans text-sm text-text-primary">{o.label}</span>
              <span className="font-dm-sans text-xs text-text-muted">{o.desc}</span>
            </label>
          ))}
        </div>
        {monitor.last_check_at && (
          <p className="font-dm-mono text-xs text-text-muted mt-2">
            Dernière synchro : {new Date(monitor.last_check_at).toLocaleString('fr-FR')}
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
        <button role="switch" aria-checked={monitor.auto_analyze}
          onClick={() => updateMutation.mutate({ id: monitor.id, auto_analyze: !monitor.auto_analyze })}
          className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${monitor.auto_analyze ? 'bg-gold' : 'bg-bg-elevated border border-border-default'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${monitor.auto_analyze ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </label>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────

export default function MonitorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const vaultInputRef = useRef(null);

  // États Vault
  const [dragOver, setDragOver] = useState(false);
  const [vaultUploading, setVaultUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

  // États dossier local
  const [localHandle, setLocalHandle] = useState(null);
  const [localSupported] = useState(() => 'showDirectoryPicker' in window);
  const [scanningLocal, setScanningLocal] = useState(false);
  const [autoScanPending, setAutoScanPending] = useState(false);

  // États OAuth
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [connectingOneDrive, setConnectingOneDrive] = useState(false);
  const [showGoogleFolders, setShowGoogleFolders] = useState(false);
  const [showOneDriveFolders, setShowOneDriveFolders] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);

  // Restore local handle depuis IndexedDB au montage
  useEffect(() => {
    idbGet('local_folder').then(h => h && setLocalHandle(h));
  }, []);

  // Auto-scan local folder si la permission est déjà accordée et fréquence dépassée
  useEffect(() => {
    if (!localHandle) return;
    (async () => {
      try {
        const perm = await localHandle.queryPermission({ mode: 'read' });
        if (perm !== 'granted') return;
        const lastScan = localStorage.getItem('dippro-local-last-scan');
        if (!lastScan) { setAutoScanPending(true); return; }
        const elapsed = Date.now() - new Date(lastScan).getTime();
        const freqDays = { '2_days': 2, '3_days': 3, '1_week': 7 };
        const freqKey = localStorage.getItem('dippro-local-freq') || '1_week';
        const limitMs = (freqDays[freqKey] || 7) * 86400000;
        if (elapsed > limitMs) setAutoScanPending(true);
      } catch { }
    })();
  }, [localHandle]);

  // Auto-scan silencieux si permission déjà accordée
  useEffect(() => {
    if (!autoScanPending || !localHandle || scanningLocal) return;
    (async () => {
      try {
        const perm = await localHandle.queryPermission({ mode: 'read' });
        if (perm === 'granted') await performLocalScan(true);
      } catch { }
    })();
  }, [autoScanPending]);

  // Gestion retours OAuth
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected === 'google') {
      toast.success('Google Drive connecté !');
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
      setSearchParams({});
    }
    if (connected === 'onedrive') {
      toast.success('OneDrive connecté !');
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
      setSearchParams({});
    }
    if (error) {
      const msgs = { oauth_denied: 'Connexion annulée', invalid_session: 'Session expirée', token_failed: 'Erreur de token', server_error: 'Erreur serveur' };
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

  const { data: gFolders, refetch: refetchGF, isFetching: loadingGF } = useQuery({
    queryKey: ['monitor-gfolders'],
    queryFn: () => api.get('/monitor/google/folders').then(r => r.data),
    enabled: false, retry: false,
  });

  const { data: odFolders, refetch: refetchODF, isFetching: loadingODF } = useQuery({
    queryKey: ['monitor-odfolders'],
    queryFn: () => api.get('/monitor/onedrive/folders').then(r => r.data),
    enabled: false, retry: false,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: ({ id, ...u }) => api.put(`/monitor/config/${id}`, u),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['monitor-config'] }),
    onError: e => toast.error(e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: (source) => ({
      google_drive: () => api.delete('/monitor/google/disconnect'),
      onedrive:     () => api.delete('/monitor/onedrive/disconnect'),
      vault:        () => api.delete('/monitor/vault/disconnect'),
    }[source]?.() || Promise.resolve()),
    onSuccess: (_, source) => {
      toast.success({ google_drive: 'Google Drive déconnecté', onedrive: 'OneDrive déconnecté', vault: 'Vault vidé' }[source] || 'Déconnecté');
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
      queryClient.invalidateQueries({ queryKey: ['monitor-files'] });
    },
    onError: e => toast.error(e.message),
  });

  // ── Upload Vault ──────────────────────────────────────────────────────────

  const uploadToVault = useCallback(async (fileList) => {
    if (!fileList.length || !user) return;
    setVaultUploading(true);
    setUploadProgress({ done: 0, total: fileList.length });
    const tid = toast.loading(`Analyse et upload… (0/${fileList.length})`);

    const synced = [];
    for (let i = 0; i < fileList.length; i++) {
      const { file, path } = fileList[i];
      try {
        const buf = await file.arrayBuffer();
        const hash = await sha256hex(buf);
        const storagePath = `${user.id}/${path}`;
        const mime = file.type || (path.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        const { error } = await supabase.storage.from('vault').upload(storagePath, file, { upsert: true, contentType: mime });
        if (!error) {
          synced.push({ storage_path: storagePath, file_name: path.split('/').pop(), hash, size: file.size, last_modified: new Date(file.lastModified).toISOString(), mime_type: mime });
        }
      } catch { }

      setUploadProgress({ done: i + 1, total: fileList.length });
      toast.loading(`Analyse et upload… (${i + 1}/${fileList.length})`, { id: tid });
    }

    toast.dismiss(tid);
    if (!synced.length) { toast.error('Aucun fichier uploadé'); setVaultUploading(false); return; }

    try {
      const res = await api.post('/monitor/vault/sync', { files: synced });
      const { changes, files_checked } = res.data;
      toast.success(changes > 0
        ? `${changes} document(s) analysé(s) par IA sur ${files_checked} uploadé(s)`
        : `${files_checked} document(s) synchronisé(s) — aucun changement`);
      queryClient.invalidateQueries({ queryKey: ['monitor-files'] });
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally {
      setVaultUploading(false);
    }
  }, [user, queryClient]);

  // ── Dossier local ─────────────────────────────────────────────────────────

  const performLocalScan = useCallback(async (silent = false) => {
    if (!localHandle) return;
    setScanningLocal(true);
    setAutoScanPending(false);
    const tid = silent ? null : toast.loading('Scan en cours…');
    try {
      const perm = await localHandle.requestPermission({ mode: 'read' });
      if (perm !== 'granted') {
        if (tid) toast.dismiss(tid);
        if (!silent) toast.error('Permission refusée');
        return;
      }

      const scanned = await scanDirHandle(localHandle);
      if (!scanned.length) {
        if (tid) toast.dismiss(tid);
        if (!silent) toast('Aucun fichier compatible trouvé', { icon: '📁' });
        return;
      }

      const filesData = [];
      for (const { file, path } of scanned) {
        const buf = await file.arrayBuffer();
        filesData.push({
          name: path,
          content_base64: toBase64(buf),
          mime_type: file.type || (path.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
          hash: await sha256hex(buf),
          last_modified: new Date(file.lastModified).toISOString(),
        });
      }

      if (tid) toast.dismiss(tid);
      const res = await api.post('/monitor/local/check', { folder_name: localHandle.name, files: filesData });
      const { changes, files_checked } = res.data;
      localStorage.setItem('dippro-local-last-scan', new Date().toISOString());
      if (!silent || changes > 0) {
        toast.success(changes > 0
          ? `${changes} modification(s) sur ${files_checked} fichier(s)`
          : `${files_checked} fichier(s) analysé(s) — aucun changement`);
      }
      queryClient.invalidateQueries({ queryKey: ['monitor-files'] });
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
    } catch (e) {
      if (tid) toast.dismiss(tid);
      if (!silent) toast.error(e.response?.data?.error || e.message || 'Erreur scan');
    } finally {
      setScanningLocal(false);
    }
  }, [localHandle, queryClient]);

  const handleConnectLocal = async () => {
    if (!localSupported) return toast.error('Utilisez Chrome ou Edge');
    try {
      const h = await window.showDirectoryPicker({ mode: 'read' });
      await idbSet('local_folder', h);
      setLocalHandle(h);
      setAutoScanPending(true);
      toast.success(`Dossier "${h.name}" connecté — scan en cours…`);
    } catch (e) {
      if (e.name !== 'AbortError') toast.error('Accès refusé');
    }
  };

  const handleDisconnectLocal = async () => {
    if (!confirm('Déconnecter le dossier local ?')) return;
    await idbDel('local_folder');
    await api.delete('/monitor/local/disconnect').catch(() => {});
    setLocalHandle(null);
    localStorage.removeItem('dippro-local-last-scan');
    toast.success('Dossier local déconnecté');
    queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
    queryClient.invalidateQueries({ queryKey: ['monitor-files'] });
  };

  // ── OAuth handlers ────────────────────────────────────────────────────────

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const r = await api.get('/monitor/google/auth');
      window.location.href = r.data.auth_url;
    } catch (e) {
      toast.error(e.response?.data?.error?.includes('GOOGLE_CLIENT_ID') ? 'Configurez GOOGLE_CLIENT_ID dans Vercel' : e.response?.data?.error || e.message);
      setConnectingGoogle(false);
    }
  };

  const handleConnectOneDrive = async () => {
    setConnectingOneDrive(true);
    try {
      const r = await api.get('/monitor/onedrive/auth');
      window.location.href = r.data.auth_url;
    } catch (e) {
      toast.error(e.response?.data?.error?.includes('MICROSOFT_CLIENT_ID') ? 'Configurez MICROSOFT_CLIENT_ID dans Vercel' : e.response?.data?.error || e.message);
      setConnectingOneDrive(false);
    }
  };

  const handleSelectFolder = (source, folder) => {
    const m = source === 'google_drive' ? googleMonitor : onedriveMonitor;
    if (!m) return;
    updateMutation.mutate({ id: m.id, folder_id: folder.id, folder_name: folder.name });
    source === 'google_drive' ? setShowGoogleFolders(false) : setShowOneDriveFolders(false);
  };

  const handleCheckNow = async () => {
    setCheckingNow(true);
    try {
      const r = await api.post('/monitor/check-now');
      toast.success(r.data.changes > 0 ? `${r.data.changes} document(s) modifié(s)` : `${r.data.files_checked} document(s) — aucun changement`);
      queryClient.invalidateQueries({ queryKey: ['monitor-files'] });
      queryClient.invalidateQueries({ queryKey: ['monitor-config'] });
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally {
      setCheckingNow(false);
    }
  };

  // ── Données dérivées ──────────────────────────────────────────────────────

  const monitors = configData?.monitors || [];
  const vaultMonitor    = monitors.find(m => m.source === 'vault');
  const localMonitor    = monitors.find(m => m.source === 'local_folder');
  const googleMonitor   = monitors.find(m => m.source === 'google_drive');
  const onedriveMonitor = monitors.find(m => m.source === 'onedrive');
  const files = filesData?.files || [];
  const changed = files.filter(f => f.status === 'new' || f.status === 'changed');
  const anyCloud = googleMonitor || onedriveMonitor;

  if (isLoading) return <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>;

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="Surveillance documentaire"
        subtitle="DIPpro détecte automatiquement les changements dans vos documents et met à jour votre DIP"
        action={
          anyCloud && (
            <button onClick={handleCheckNow} disabled={checkingNow} className="btn-primary flex items-center gap-2 text-sm">
              {checkingNow ? <LoadingSpinner size="sm" /> : <Play className="w-4 h-4" />}
              Vérifier maintenant
            </button>
          )
        }
      />

      {/* ══ DIPpro Vault ════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${vaultMonitor ? 'bg-success/10 border-success/20' : 'bg-gold/8 border-gold/20'}`}>
              <Shield className={`w-5 h-5 ${vaultMonitor ? 'text-success' : 'text-gold'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-dm-sans text-sm font-medium text-text-primary">DIPpro Vault</p>
                <span className="font-dm-mono text-xs px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">Zéro config</span>
              </div>
              <p className="font-dm-mono text-xs text-text-secondary mt-0.5">
                {vaultMonitor
                  ? `Actif — glissez des fichiers pour mettre à jour`
                  : 'Stockage sécurisé intégré — tous appareils, tous navigateurs'}
              </p>
            </div>
          </div>
          {vaultMonitor && (
            <button
              onClick={() => { if (confirm('Vider le Vault et supprimer tous les fichiers stockés ?')) disconnectMutation.mutate('vault'); }}
              disabled={disconnectMutation.isPending}
              className="btn-ghost text-xs flex items-center gap-1.5 text-danger hover:text-danger/80"
            >
              <Trash2 className="w-3.5 h-3.5" /> Vider
            </button>
          )}
        </div>

        {/* Zone drag & drop */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
          onDrop={async e => {
            e.preventDefault();
            setDragOver(false);
            const files = await extractDroppedFiles(Array.from(e.dataTransfer.items));
            if (files.length) uploadToVault(files);
            else toast.error('Aucun fichier PDF ou Word compatible');
          }}
          onClick={() => !vaultUploading && vaultInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none ${
            dragOver ? 'border-gold bg-gold/5 scale-[1.01]' : 'border-border-default hover:border-gold/40 hover:bg-gold/3'
          }`}
        >
          {vaultUploading ? (
            <div className="space-y-3">
              <LoadingSpinner size="md" className="mx-auto" />
              <p className="font-dm-sans text-sm text-text-primary">
                Upload {uploadProgress.done}/{uploadProgress.total}…
              </p>
              <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden max-w-xs mx-auto">
                <div
                  className="h-full bg-gold rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.total ? (uploadProgress.done / uploadProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <Upload className={`w-8 h-8 mx-auto mb-3 transition-colors ${dragOver ? 'text-gold' : 'text-text-muted'}`} />
              <p className="font-dm-sans text-sm font-medium text-text-primary mb-1">
                Glissez vos fichiers ou dossiers ici
              </p>
              <p className="font-dm-sans text-xs text-text-muted">PDF, Word, Excel · 10 Mo max · Analyse IA automatique</p>
            </>
          )}
        </div>

        {/* Input file caché */}
        <input
          ref={vaultInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.doc"
          className="hidden"
          onChange={async e => {
            const list = Array.from(e.target.files || [])
              .filter(f => f.size <= MAX_FILE_BYTES && isSupported(f.name))
              .map(f => ({ file: f, path: f.name }));
            if (list.length) await uploadToVault(list);
            e.target.value = '';
          }}
        />

        {vaultMonitor && <FreqConfig monitor={vaultMonitor} updateMutation={updateMutation} />}

        {!vaultMonitor && (
          <p className="font-dm-sans text-xs text-text-muted text-center mt-3">
            Vos fichiers sont chiffrés et stockés dans votre espace Supabase privé.
          </p>
        )}
      </div>

      {/* ══ Dossier local — Mac & Windows ════════════════════════════════════ */}
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
                  ? `${localHandle.name}${autoScanPending ? ' · scan en attente…' : ''}`
                  : localSupported ? 'Mac & Windows · Chrome / Edge' : 'Requiert Chrome ou Edge'}
              </p>
            </div>
          </div>
          {localHandle ? (
            <div className="flex gap-2">
              <button
                onClick={() => performLocalScan(false)}
                disabled={scanningLocal}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                {scanningLocal ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Scanner
              </button>
              <button onClick={handleDisconnectLocal} className="btn-ghost text-xs flex items-center gap-1.5 text-danger hover:text-danger/80">
                <Unlink className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={handleConnectLocal} disabled={!localSupported} className="btn-liquid-glass-prominent flex items-center gap-2 text-sm disabled:opacity-40">
              <HardDrive className="w-4 h-4" /> Connecter
            </button>
          )}
        </div>

        {localHandle && localMonitor && <FreqConfig monitor={localMonitor} updateMutation={updateMutation} />}
        {!localHandle && <Tip>Accès direct aux PDF et Word de votre Mac ou PC. Les fichiers sont lus localement — rien n'est envoyé sans votre déclenchement.</Tip>}
      </div>

      {/* ══ Google Drive ══════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${googleMonitor ? 'bg-success/10 border-success/20' : 'bg-bg-elevated border-border-subtle'}`}>
              <Cloud className={`w-5 h-5 ${googleMonitor ? 'text-success' : 'text-text-secondary'}`} />
            </div>
            <div>
              <p className="font-dm-sans text-sm font-medium text-text-primary">Google Drive</p>
              <p className="font-dm-mono text-xs text-text-secondary mt-0.5">
                {googleMonitor ? `Connecté : ${googleMonitor.drive_email || 'compte Google'}` : 'Mac · Windows · iOS · Android · Samsung'}
              </p>
            </div>
          </div>
          {googleMonitor ? (
            <div className="flex items-center gap-3">
              <span className="font-dm-mono text-xs text-success flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Actif</span>
              <button onClick={() => { if (confirm('Déconnecter Google Drive ?')) disconnectMutation.mutate('google_drive'); }} className="btn-ghost text-xs flex items-center gap-1.5 text-danger hover:text-danger/80">
                <Unlink className="w-3.5 h-3.5" /> Déconnecter
              </button>
            </div>
          ) : (
            <button onClick={handleConnectGoogle} disabled={connectingGoogle} className="btn-liquid-glass-prominent flex items-center gap-2 text-sm">
              {connectingGoogle ? <LoadingSpinner size="sm" /> : <Cloud className="w-4 h-4" />} Connecter
            </button>
          )}
        </div>

        {googleMonitor && (
          <>
            <div className="flex items-center justify-between bg-bg-elevated rounded-lg px-4 py-2.5 mb-3">
              <div>
                <p className="font-dm-sans text-sm text-text-primary">{googleMonitor.folder_name || 'Tout Mon Drive'}</p>
                <p className="font-dm-mono text-xs text-text-muted mt-0.5">{googleMonitor.folder_id || 'Tous les fichiers compatibles'}</p>
              </div>
              <button onClick={() => { setShowGoogleFolders(v => !v); refetchGF(); }} className="btn-secondary text-xs flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" /> Changer
              </button>
            </div>
            {showGoogleFolders && (
              <div className="border border-border-default rounded-xl overflow-hidden mb-3">
                {loadingGF ? <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div> : (
                  <div className="max-h-44 overflow-y-auto divide-y divide-border-subtle">
                    {(gFolders?.folders || []).map(f => (
                      <button key={f.id || 'root'} onClick={() => handleSelectFolder('google_drive', f)}
                        className={`w-full text-left px-4 py-2.5 hover:bg-bg-elevated flex items-center gap-3 ${googleMonitor.folder_id === f.id ? 'bg-gold/5' : ''}`}>
                        <FolderOpen className="w-4 h-4 text-gold flex-shrink-0" />
                        <span className="font-dm-sans text-sm text-text-primary">{f.name}</span>
                        {googleMonitor.folder_id === f.id && <CheckCircle className="w-3.5 h-3.5 text-success ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <FreqConfig monitor={googleMonitor} updateMutation={updateMutation} />
          </>
        )}

        {!googleMonitor && (
          <Tip>Surveillance automatique en arrière-plan toutes les N jours. Détecte les bilans, actes INPI, contrats. Nécessite une configuration OAuth (15 min) — voir guide ci-dessous.</Tip>
        )}
      </div>

      {/* ══ OneDrive ══════════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${onedriveMonitor ? 'bg-success/10 border-success/20' : 'bg-bg-elevated border-border-subtle'}`}>
              <FolderSync className={`w-5 h-5 ${onedriveMonitor ? 'text-success' : 'text-text-secondary'}`} />
            </div>
            <div>
              <p className="font-dm-sans text-sm font-medium text-text-primary">
                OneDrive <span className="font-dm-mono text-xs text-text-muted">Microsoft</span>
              </p>
              <p className="font-dm-mono text-xs text-text-secondary mt-0.5">
                {onedriveMonitor ? `Connecté : ${onedriveMonitor.drive_email || 'compte Microsoft'}` : 'Windows · Mac · SharePoint · Microsoft 365'}
              </p>
            </div>
          </div>
          {onedriveMonitor ? (
            <div className="flex items-center gap-3">
              <span className="font-dm-mono text-xs text-success flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Actif</span>
              <button onClick={() => { if (confirm('Déconnecter OneDrive ?')) disconnectMutation.mutate('onedrive'); }} className="btn-ghost text-xs flex items-center gap-1.5 text-danger hover:text-danger/80">
                <Unlink className="w-3.5 h-3.5" /> Déconnecter
              </button>
            </div>
          ) : (
            <button onClick={handleConnectOneDrive} disabled={connectingOneDrive} className="btn-liquid-glass-prominent flex items-center gap-2 text-sm">
              {connectingOneDrive ? <LoadingSpinner size="sm" /> : <FolderSync className="w-4 h-4" />} Connecter
            </button>
          )}
        </div>

        {onedriveMonitor && (
          <>
            <div className="flex items-center justify-between bg-bg-elevated rounded-lg px-4 py-2.5 mb-3">
              <div>
                <p className="font-dm-sans text-sm text-text-primary">{onedriveMonitor.folder_name || 'Tout Mon OneDrive'}</p>
                <p className="font-dm-mono text-xs text-text-muted mt-0.5">{onedriveMonitor.folder_id || 'Tous les dossiers compatibles'}</p>
              </div>
              <button onClick={() => { setShowOneDriveFolders(v => !v); refetchODF(); }} className="btn-secondary text-xs flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" /> Changer
              </button>
            </div>
            {showOneDriveFolders && (
              <div className="border border-border-default rounded-xl overflow-hidden mb-3">
                {loadingODF ? <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div> : (
                  <div className="max-h-44 overflow-y-auto divide-y divide-border-subtle">
                    {(odFolders?.folders || []).map(f => (
                      <button key={f.id || 'root'} onClick={() => handleSelectFolder('onedrive', f)}
                        className={`w-full text-left px-4 py-2.5 hover:bg-bg-elevated flex items-center gap-3 ${onedriveMonitor.folder_id === f.id ? 'bg-gold/5' : ''}`}>
                        <FolderOpen className="w-4 h-4 text-gold flex-shrink-0" />
                        <span className="font-dm-sans text-sm text-text-primary">{f.name}</span>
                        {onedriveMonitor.folder_id === f.id && <CheckCircle className="w-3.5 h-3.5 text-success ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <FreqConfig monitor={onedriveMonitor} updateMutation={updateMutation} />
          </>
        )}

        {!onedriveMonitor && (
          <Tip>Surveillance automatique de votre OneDrive ou SharePoint. Nécessite une configuration Azure (15 min) — voir guide ci-dessous.</Tip>
        )}
      </div>

      {/* ══ Samsung ═══════════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-bg-elevated border-border-subtle">
            <Smartphone className="w-5 h-5 text-text-secondary" />
          </div>
          <div>
            <p className="font-dm-sans text-sm font-medium text-text-primary">Samsung Galaxy <span className="font-dm-mono text-xs text-text-muted">Android</span></p>
            <p className="font-dm-mono text-xs text-text-secondary mt-0.5">Fonctionne via Google Drive ou OneDrive</p>
          </div>
        </div>
        <Tip>
          Sur votre Samsung : Paramètres → Comptes → Google → activez la sync Drive. Puis connectez Google Drive ici → DIPpro détecte automatiquement vos fichiers Galaxy synchronisés.
        </Tip>
      </div>

      {/* ══ Fichiers détectés ══════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-cormorant text-xl text-text-primary">
            Fichiers détectés
            {files.length > 0 && <span className="font-dm-mono text-sm text-text-secondary ml-2">({files.length})</span>}
          </h2>
          {changed.length > 0 && (
            <span className="font-dm-mono text-xs px-2 py-1 rounded bg-warning/10 text-warning border border-warning/20">
              {changed.length} à examiner
            </span>
          )}
        </div>

        {files.length === 0 ? (
          <div className="card text-center py-10">
            <FileText className="w-9 h-9 text-text-muted mx-auto mb-3" />
            <p className="font-dm-sans text-sm text-text-secondary">Glissez des fichiers dans le Vault pour commencer</p>
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
                  {files.map((f, i) => (
                    <tr key={f.id} className={`border-b border-border-subtle hover:bg-bg-elevated transition-colors ${i === files.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-dm-sans text-sm text-text-primary font-medium truncate max-w-[160px]">{f.file_name}</p>
                      </td>
                      <td className="px-4 py-3 font-dm-mono text-xs text-text-secondary whitespace-nowrap">
                        {MIME_LABELS[f.mime_type] || 'Document'}
                      </td>
                      <td className="px-4 py-3 font-dm-mono text-xs text-text-secondary whitespace-nowrap">
                        {f.last_modified ? new Date(f.last_modified).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3"><Badge status={f.status} /></td>
                      <td className="px-4 py-3 max-w-xs">
                        {f.change_summary
                          ? <p className="font-dm-sans text-xs text-text-secondary line-clamp-2">{f.change_summary}</p>
                          : <span className="font-dm-mono text-xs text-text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
