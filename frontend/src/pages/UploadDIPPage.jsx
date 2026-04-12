import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Upload, FileText, File, X, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UploadDIPPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [step, setStep] = useState('idle'); // idle | uploading | analyzing | done | error
  const [result, setResult] = useState(null);

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) {
      setFile(accepted[0]);
      setTitle(accepted[0].name.replace(/\.(pdf|docx|doc)$/i, ''));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc']
    },
    maxSize: 20 * 1024 * 1024,
    maxFiles: 1,
    onDropRejected: (files) => {
      const err = files[0]?.errors[0];
      if (err?.code === 'file-too-large') toast.error('Fichier trop volumineux (max 20 Mo)');
      else toast.error('Format non supporté. Utilisez PDF ou DOCX.');
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      return api.post('/dip/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000 // 2 min pour le parsing IA
      });
    },
    onMutate: () => {
      setStep('uploading');
      setTimeout(() => setStep('analyzing'), 2000);
    },
    onSuccess: (res) => {
      setResult(res.data);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['dips'] });
      toast.success('DIP analysé avec succès !');
    },
    onError: (err) => {
      setStep('error');
      toast.error(err.message);
    }
  });

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <PageHeader
        title="Importer un DIP"
        subtitle="Uploadez votre Document d'Information Précontractuelle au format PDF ou DOCX. L'IA analysera et structurera automatiquement les 10 sections réglementaires."
      />

      {step === 'done' && result ? (
        /* Résultat du parsing */
        <div className="card border-success/30 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="font-dm-sans text-sm font-medium text-text-primary">Analyse terminée</p>
              <p className="font-dm-mono text-xs text-text-secondary">
                {result.sections_count} sections extraites
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-bg-elevated rounded">
              <p className="font-cormorant text-3xl text-gold">{result.conformity_score}%</p>
              <p className="font-dm-sans text-xs text-text-secondary">Score initial</p>
            </div>
            <div className="text-center p-4 bg-bg-elevated rounded">
              <p className="font-cormorant text-3xl text-text-primary">{result.sections_count}</p>
              <p className="font-dm-sans text-xs text-text-secondary">Sections</p>
            </div>
            <div className="text-center p-4 bg-bg-elevated rounded">
              <p className="font-cormorant text-3xl text-text-primary">IA</p>
              <p className="font-dm-sans text-xs text-text-secondary">Claude Sonnet</p>
            </div>
          </div>

          {result.summary && (
            <div className="bg-gold/5 border border-gold/20 rounded p-4 mb-6">
              <p className="font-dm-mono text-xs text-gold mb-2">Résumé IA</p>
              <p className="font-dm-sans text-sm text-text-primary">{result.summary}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => navigate('/dip')} className="btn-primary flex-1">
              Consulter les sections
            </button>
            <button onClick={() => { setStep('idle'); setFile(null); setResult(null); }}
              className="btn-secondary">
              Importer un autre
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Zone de drop */}
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-300 ${
              isDragActive
                ? 'border-gold bg-gold/5'
                : file
                ? 'border-success/40 bg-success/3'
                : 'border-border-default hover:border-gold hover:bg-gold/3'
            } ${step !== 'idle' ? 'pointer-events-none' : ''}`}
          >
            <input {...getInputProps()} />

            {step === 'uploading' || step === 'analyzing' ? (
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-gold/10 border border-gold/20">
                  {step === 'uploading' ? (
                    <LoadingSpinner size="md" />
                  ) : (
                    <Sparkles className="w-7 h-7 text-gold animate-pulse" />
                  )}
                </div>
                <div>
                  <p className="font-dm-sans text-sm font-medium text-text-primary">
                    {step === 'uploading' ? 'Upload en cours...' : 'Analyse IA en cours...'}
                  </p>
                  <p className="font-dm-sans text-xs text-text-secondary mt-1">
                    {step === 'uploading'
                      ? 'Envoi du fichier'
                      : 'Claude extrait et structure les 10 sections — cela peut prendre 30 secondes'
                    }
                  </p>
                </div>
                <div className="w-48 h-1 bg-bg-elevated rounded-full mx-auto overflow-hidden">
                  <div className="h-full bg-gold rounded-full animate-pulse" style={{ width: step === 'analyzing' ? '70%' : '30%', transition: 'width 2s ease' }} />
                </div>
              </div>
            ) : file ? (
              <div className="space-y-3">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-success/10 border border-success/20">
                  <FileText className="w-7 h-7 text-success" />
                </div>
                <div>
                  <p className="font-dm-sans text-sm font-medium text-text-primary">{file.name}</p>
                  <p className="font-dm-mono text-xs text-text-secondary">{formatSize(file.size)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-danger transition-colors"
                >
                  <X className="w-3 h-3" /> Supprimer
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-gold/10 border border-gold/20">
                  <Upload className="w-7 h-7 text-gold" />
                </div>
                <div>
                  <p className="font-dm-sans text-sm font-medium text-text-primary">
                    {isDragActive ? 'Déposez ici' : 'Glissez-déposez votre DIP'}
                  </p>
                  <p className="font-dm-sans text-xs text-text-secondary mt-1">
                    PDF ou DOCX, max 20 Mo
                  </p>
                </div>
                <span className="inline-block font-dm-sans text-xs text-gold border border-gold/30 rounded px-3 py-1">
                  Parcourir les fichiers
                </span>
              </div>
            )}
          </div>

          {/* Champ titre */}
          {file && step === 'idle' && (
            <div className="animate-slide-up">
              <label className="label">Titre du document</label>
              <input
                type="text"
                className="input-field"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="DIP 2024 - Ma Franchise"
              />
            </div>
          )}

          {/* Bouton upload */}
          {file && step === 'idle' && (
            <button
              onClick={() => uploadMutation.mutate()}
              disabled={!file || uploadMutation.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Analyser avec l'IA
            </button>
          )}

          {step === 'error' && (
            <div className="flex items-center gap-3 bg-danger/10 border border-danger/20 text-danger rounded p-3 text-sm font-dm-sans">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Erreur lors de l'analyse. Vérifiez que le fichier est lisible et réessayez.
              <button onClick={() => setStep('idle')} className="ml-auto underline">Réessayer</button>
            </div>
          )}

          {/* Info */}
          <div className="bg-gold/5 border border-gold/20 rounded p-4">
            <p className="font-dm-mono text-xs text-gold mb-2">Comment ça fonctionne</p>
            <ol className="space-y-1">
              {[
                'Votre fichier est uploadé de manière sécurisée',
                'L\'IA Claude extrait le texte du document',
                'Les 10 sections réglementaires sont identifiées et structurées',
                'Un score de conformité initial est calculé',
                'Vous pouvez ensuite modifier et valider chaque section'
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 font-dm-sans text-xs text-text-secondary">
                  <span className="font-dm-mono text-gold/60">{i + 1}.</span> {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
