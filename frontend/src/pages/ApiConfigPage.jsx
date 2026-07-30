import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { supabase as supabaseClient } from '../lib/supabase';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  CheckCircle, Unlink, AlertTriangle, Cloud,
  UploadCloud, FileText, Trash2, Eye, Info, X as XIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';

const STORAGE_BUCKET = 'user-documents';

function InfoWidget({ title, content, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card max-w-md w-full space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-gold" />
            <h3 className="font-cormorant text-xl text-text-primary">{title}</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-elevated">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="font-dm-sans text-sm text-text-secondary leading-relaxed">
          {content}
        </div>
        <button onClick={onClose} className="btn-primary w-full">Compris</button>
      </div>
    </div>
  );
}

function LocalFilesSection() {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: filesData, isLoading } = useQuery({
    queryKey: ['local-integrations'],
    queryFn: () => api.get('/integrations/local-files').then(r => r.data),
  });

  const localFiles = filesData?.files || [];

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList).filter(f => {
      const ok = f.type === 'application/pdf'
        || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || f.name.toLowerCase().endsWith('.pdf')
        || f.name.toLowerCase().endsWith('.docx');
      if (!ok) toast.error(`Format non supporté : ${f.name} (PDF ou DOCX uniquement)`);
      return ok;
    });

    if (!files.length) return;

    for (const file of files) {
      const id = `${Date.now()}-${file.name}`;
      setUploads(u => [...u, { id, name: file.name, status: 'uploading', pct: 0 }]);

      try {
        const token = localStorage.getItem('access_token');
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('Non authentifié');

        const path = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        const { error: uploadError } = await supabaseClient.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { upsert: false });

        if (uploadError) throw new Error(uploadError.message);

        const { data: urlData } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);

        await api.post('/integrations/local-files', {
          name: file.name,
          storage_path: path,
          file_url: urlData.publicUrl,
          mime_type: file.type,
          size_bytes: file.size,
        });

        setUploads(u => u.map(up => up.id === id ? { ...up, status: 'done' } : up));
        queryClient.invalidateQueries({ queryKey: ['local-integrations'] });
        toast.success(`${file.name} importé et analysé !`);
      } catch (err) {
        setUploads(u => u.map(up => up.id === id ? { ...up, status: 'error', error: err.message } : up));
        toast.error(`Erreur : ${err.message}`);
      }
    }

    setTimeout(() => setUploads([]), 4000);
  };

  const deleteMutation = useMutation({
    mutationFn: (fileId) => api.delete(`/integrations/local-files/${fileId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-integrations'] });
      toast.success('Document supprimé');
    },
    onError: (err) => toast.error(err.message),
  });

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-cormorant text-2xl text-text-primary">Mes documents</h2>
          <p className="font-dm-sans text-sm text-text-secondary mt-1">
            Importez vos PDF et DOCX — ils seront analysés automatiquement par l'IA et intégrés à votre surveillance.
          </p>
        </div>
        <button
          onClick={() => setInfoOpen(true)}
          className="p-2 rounded-lg hover:bg-bg-elevated text-text-secondary hover:text-gold transition-colors"
          title="Comment ça fonctionne ?"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 sm:p-10 text-center cursor-pointer transition-all ${
          dragging
            ? 'border-gold bg-gold/8 scale-[1.01]'
            : 'border-border-default hover:border-gold/40 hover:bg-bg-elevated'
        }`}
      >
        <UploadCloud className={`w-10 h-10 mx-auto mb-3 transition-colors ${dragging ? 'text-gold' : 'text-text-muted'}`} />
        <p className="font-dm-sans text-sm font-medium text-text-primary">
          Glissez vos fichiers ici ou <span className="text-gold">cliquez pour sélectionner</span>
        </p>
        <p className="font-dm-mono text-xs text-text-muted mt-1">PDF, DOCX · Plusieurs fichiers acceptés</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map(up => (
            <div key={up.id} className="flex items-center gap-3 card py-2 px-4">
              <FileText className="w-4 h-4 text-text-secondary flex-shrink-0" />
              <span className="flex-1 font-dm-sans text-sm text-text-primary truncate">{up.name}</span>
              {up.status === 'uploading' && <LoadingSpinner size="sm" />}
              {up.status === 'done' && <CheckCircle className="w-4 h-4 text-success" />}
              {up.status === 'error' && <AlertTriangle className="w-4 h-4 text-danger" title={up.error} />}
            </div>
          ))}
        </div>
      )}

      {/* Uploaded files list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : localFiles.length === 0 ? (
        <div className="text-center py-8 text-text-muted font-dm-sans text-sm">
          Aucun document importé pour l'instant.
        </div>
      ) : (
        <div className="space-y-2">
          {localFiles.map(file => (
            <div key={file.id} className="card flex items-center gap-3 py-3">
              <FileText className="w-4 h-4 text-gold flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-dm-sans text-sm text-text-primary truncate">{file.name}</p>
                <p className="font-dm-mono text-xs text-text-muted">
                  {file.size_bytes ? `${Math.round(file.size_bytes / 1024)} Ko · ` : ''}
                  {file.created_at ? new Date(file.created_at).toLocaleDateString('fr-FR') : ''}
                  {file.impact_level && file.impact_level !== 'none'
                    ? ` · Impact : ${file.impact_level}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {file.file_url && (
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-gold transition-colors"
                    title="Voir le fichier"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => deleteMutation.mutate(file.id)}
                  className="p-1.5 rounded-lg hover:bg-danger/8 text-text-muted hover:text-danger transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {infoOpen && (
        <InfoWidget
          title="Comment ça fonctionne ?"
          content={
            <div className="space-y-3">
              <p>Importez vos documents juridiques, réglementaires ou de franchise en PDF ou DOCX.</p>
              <p>DIPpro les analyse automatiquement avec Claude IA et détecte les impacts potentiels sur votre DIP.</p>
              <p>Les documents sont stockés de façon sécurisée et privée dans votre espace DIPpro.</p>
              <p className="font-dm-mono text-xs text-text-muted">Formats acceptés : PDF, DOCX · Taille max : 50 Mo par fichier</p>
            </div>
          }
          onClose={() => setInfoOpen(false)}
        />
      )}
    </div>
  );
}

function GoogleDriveSection({ status }) {
  const gc = status?.google_drive;
  const configured = status?.configured?.google;
  const [infoOpen, setInfoOpen] = useState(false);

  const handleConnect = () => {
    window.location.href = '/api/integrations/google/connect?scope=drive';
  };

  const handleDisconnect = async () => {
    try {
      await api.delete('/integrations/google?scope=drive');
      toast.success('Google Drive déconnecté');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="card">
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${
          gc?.connected ? 'bg-success/10 border-success/20' : 'bg-gold/8 border-gold/20'
        }`}>
          <Cloud className={`w-5 h-5 ${gc?.connected ? 'text-success' : 'text-gold'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-dm-sans text-sm font-semibold text-text-primary">Google Drive</p>
            <span className="font-dm-mono text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(200,169,110,0.08)', color: 'rgba(200,169,110,0.7)', border: '0.5px solid rgba(200,169,110,0.15)' }}>
              Cloud
            </span>
            {gc?.connected && <span className="font-dm-mono text-xs px-2 py-0.5 rounded bg-success/10 text-success border border-success/20">Connecté</span>}
          </div>
          <p className="font-dm-sans text-xs text-text-secondary">
            Surveillez automatiquement vos fichiers Google Drive. Détection des changements 3×/jour.
          </p>
          {gc?.connected && gc?.email && (
            <p className="font-dm-mono text-xs text-success/80 mt-1">{gc.email}</p>
          )}
          {!configured && (
            <p className="font-dm-mono text-xs text-text-muted mt-1">
              Nécessite une configuration OAuth côté DIPpro (contactez Iralink).
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setInfoOpen(true)}
            className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-gold transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
          {gc?.connected ? (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 font-dm-sans text-xs px-3 py-1.5 rounded-lg border transition-all hover:bg-danger/5 hover:border-danger/30 hover:text-danger"
              style={{ borderColor: 'rgba(241,124,124,0.20)', color: 'rgba(241,124,124,0.8)' }}
            >
              <Unlink className="w-3 h-3" />
              Déconnecter
            </button>
          ) : (
            <button
              onClick={configured ? handleConnect : () => setInfoOpen(true)}
              className="btn-primary text-xs py-1.5 px-3"
            >
              Connecter
            </button>
          )}
        </div>
      </div>

      {infoOpen && (
        <InfoWidget
          title="Google Drive"
          content={
            <div className="space-y-3">
              <p>La connexion Google Drive permet à DIPpro de surveiller automatiquement vos fichiers et dossiers partagés.</p>
              <p>Pour activer cette fonctionnalité, contactez l'équipe Iralink à <strong>theo@iralink-agency.com</strong> pour configurer les autorisations OAuth.</p>
              <p className="font-dm-mono text-xs text-text-muted">
                En attendant, utilisez l'upload de documents locaux ci-dessus — il offre les mêmes fonctionnalités d'analyse IA.
              </p>
            </div>
          }
          onClose={() => setInfoOpen(false)}
        />
      )}
    </div>
  );
}

export default function ApiConfigPage() {
  const location = useLocation();

  const { data: statusData } = useQuery({
    queryKey: ['integrations-status'],
    queryFn: () => api.get('/integrations/status').then(r => r.data),
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    if (connected) toast.success(`${connected.replace('_', ' ')} connecté avec succès !`);
    if (error) toast.error(`Erreur OAuth : ${error}`);
  }, [location.search]);

  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">
      <PageHeader
        title="Intégrations"
        subtitle="Importez vos documents ou connectez vos sources cloud pour une surveillance automatique"
      />

      {/* Local upload — hero section */}
      <section className="space-y-4">
        <LocalFilesSection />
      </section>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px" style={{ background: 'rgba(200,169,110,0.12)' }} />
        <span className="font-dm-mono text-xs text-text-muted">Sources cloud</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(200,169,110,0.12)' }} />
      </div>

      {/* Google Drive */}
      <GoogleDriveSection status={statusData} />
    </div>
  );
}
