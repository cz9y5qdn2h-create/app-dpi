import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  Upload, FileText, X, CheckCircle, AlertCircle, Sparkles,
  ChevronDown, ChevronUp, Check, XCircle, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

const IMPACT_CONFIG = {
  High:     { label: 'Critique', cls: 'impact-high' },
  Moderate: { label: 'Modéré',  cls: 'impact-moderate' },
  Low:      { label: 'Faible',  cls: 'impact-low' }
};

export default function UploadDIPPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const automationLevel = profile?.automation_level || 1;

  const [file, setFile]   = useState(null);
  const [title, setTitle] = useState('');
  const [step, setStep]   = useState('idle'); // idle | uploading | analyzing | report | approving | done | error

  // Comparison mode state
  const [comparisonResult, setComparisonResult] = useState(null); // { draft_dip_id, changements, resume, ... }
  const [approvedIds, setApprovedIds]     = useState(new Set());
  const [rejectedIds, setRejectedIds]     = useState(new Set());
  const [expandedId, setExpandedId]       = useState(null);

  // Initial parse mode state
  const [initialResult, setInitialResult] = useState(null);

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
        timeout: 120000
      });
    },
    onMutate: () => {
      setStep('uploading');
      setTimeout(() => setStep('analyzing'), 2000);
    },
    onSuccess: (res) => {
      const data = res.data;
      if (data.mode === 'comparison') {
        setComparisonResult(data);
        // Level 3: auto-approve all and redirect
        if (automationLevel === 3) {
          handleAutoApprove(data);
        } else {
          setStep('report');
          // Level 2: pre-select all as approved
          if (automationLevel === 2) {
            const allIds = new Set(data.changements.map(c => c.id));
            setApprovedIds(allIds);
          }
        }
      } else {
        setInitialResult(data);
        setStep('done');
        queryClient.invalidateQueries({ queryKey: ['dips'] });
        toast.success('DIP analysé avec succès !');
      }
    },
    onError: (err) => {
      setStep('error');
      toast.error(err.message);
    }
  });

  const approveMutation = useMutation({
    mutationFn: (payload) => api.post('/dip/approve-changes', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dips'] });
      setStep('done');
      toast.success('Nouvelle version activée avec succès !');
    },
    onError: (err) => {
      toast.error(err.message);
      setStep('report');
    }
  });

  const handleAutoApprove = (data) => {
    const approved = data.changements.map(c => ({ ...c, section_number: c.section_number }));
    approveMutation.mutate({
      draft_dip_id: data.draft_dip_id,
      previous_dip_id: data.previous_dip_id,
      approved_changes: approved
    });
    setStep('approving');
  };

  const handleFinalApprove = () => {
    if (!comparisonResult) return;
    const approved = comparisonResult.changements.filter(c => approvedIds.has(c.id));
    setStep('approving');
    approveMutation.mutate({
      draft_dip_id: comparisonResult.draft_dip_id,
      previous_dip_id: comparisonResult.previous_dip_id,
      approved_changes: approved
    });
  };

  const toggleApprove = (id) => {
    setApprovedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setRejectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleReject = (id) => {
    setRejectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setApprovedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const approveAll = () => {
    const allIds = new Set(comparisonResult.changements.map(c => c.id));
    setApprovedIds(allIds);
    setRejectedIds(new Set());
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const reset = () => {
    setFile(null); setTitle(''); setStep('idle');
    setComparisonResult(null); setInitialResult(null);
    setApprovedIds(new Set()); setRejectedIds(new Set());
  };

  /* ── Done state ── */
  if (step === 'done') {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
        <PageHeader title="Mise à jour DIP" subtitle="Traitement terminé" />
        <div className="card border-success/30 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="font-dm-sans text-sm font-medium text-text-primary">
                {comparisonResult ? 'Nouvelle version activée' : 'DIP analysé avec succès'}
              </p>
              <p className="font-dm-mono text-xs text-text-secondary">
                {comparisonResult
                  ? `${approvedIds.size} changement(s) approuvé(s) sur ${comparisonResult.changements.length}`
                  : `${initialResult?.sections_count} sections extraites · Score ${initialResult?.conformity_score}%`
                }
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/dip')} className="btn-liquid-glass flex-1">
              <CheckCircle className="w-4 h-4" /> Consulter le DIP
            </button>
            <button onClick={reset} className="btn-secondary">
              Importer un autre
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Approving state ── */
  if (step === 'approving') {
    return (
      <div className="max-w-2xl mx-auto text-center py-24 animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-gold/10 border border-gold/20 mb-6 animate-glow">
          <Sparkles className="w-8 h-8 text-gold animate-pulse" />
        </div>
        <p className="font-cormorant text-2xl text-text-primary mb-2">Activation en cours…</p>
        <p className="font-dm-sans text-sm text-text-secondary">La nouvelle version du DIP est en cours d'activation.</p>
      </div>
    );
  }

  /* ── Comparison Report state ── */
  if (step === 'report' && comparisonResult) {
    const changements = comparisonResult.changements || [];
    const critiques = changements.filter(c => c.impact_legal === 'High').length;
    const pendingDecision = changements.filter(c => !approvedIds.has(c.id) && !rejectedIds.has(c.id)).length;

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <PageHeader
          title="Rapport des changements"
          subtitle={comparisonResult.resume}
        />

        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center py-4">
            <p className="font-cormorant text-3xl text-text-primary">{changements.length}</p>
            <p className="font-dm-sans text-xs text-text-secondary">Changements détectés</p>
          </div>
          <div className="card text-center py-4">
            <p className="font-cormorant text-3xl text-danger">{critiques}</p>
            <p className="font-dm-sans text-xs text-text-secondary">Impact critique</p>
          </div>
          <div className="card text-center py-4">
            <p className="font-cormorant text-3xl text-gold">{approvedIds.size}</p>
            <p className="font-dm-sans text-xs text-text-secondary">Approuvés</p>
          </div>
        </div>

        {/* Level 2: Approve all button at top */}
        {automationLevel === 2 && (
          <div className="card border-gold/20 bg-gold/3">
            <div className="flex items-center gap-4">
              <AlertTriangle className="w-5 h-5 text-gold flex-shrink-0" />
              <div className="flex-1">
                <p className="font-dm-sans text-sm font-medium text-text-primary">
                  Niveau 2 — Approbation globale
                </p>
                <p className="font-dm-sans text-xs text-text-secondary">
                  Approuvez tous les changements proposés par l'IA en une seule action.
                </p>
              </div>
              <button onClick={approveAll} className="btn-liquid-glass flex-shrink-0">
                <Check className="w-4 h-4" /> Tout approuver
              </button>
            </div>
          </div>
        )}

        {/* Changes list */}
        {changements.length === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle className="w-10 h-10 text-success/40 mx-auto mb-3" />
            <p className="font-cormorant text-xl text-text-primary">Aucun changement significatif</p>
            <p className="font-dm-sans text-sm text-text-secondary mt-2">
              Les deux versions du DIP sont identiques.
            </p>
            <button onClick={() => navigate('/dip')} className="btn-liquid-glass mt-6">
              Retour au DIP
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {changements.map((c, idx) => {
              const impact = IMPACT_CONFIG[c.impact_legal] || IMPACT_CONFIG.Low;
              const isApproved = approvedIds.has(c.id);
              const isRejected = rejectedIds.has(c.id);
              const isExpanded = expandedId === c.id;

              return (
                <div
                  key={c.id}
                  className={`card transition-all duration-200 animate-slide-up stagger-${Math.min(idx + 1, 5)} ${
                    isApproved ? 'border-success/30 bg-success/3' :
                    isRejected ? 'border-danger/20 bg-danger/3' :
                    'border-border-default'
                  }`}
                >
                  {/* Header */}
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-dm-mono text-xs text-gold/60">§{c.section_number}</span>
                        <span className="font-dm-sans text-sm font-medium text-text-primary">{c.section}</span>
                        <span className={impact.cls}>{impact.label}</span>
                        {isApproved && <span className="text-xs font-dm-mono text-success">✓ Approuvé</span>}
                        {isRejected && <span className="text-xs font-dm-mono text-danger">✗ Rejeté</span>}
                      </div>
                      <p className="font-dm-sans text-xs text-text-secondary capitalize">
                        Type : {c.type?.replace(/_/g, ' ')}
                      </p>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-text-secondary flex-shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-text-secondary flex-shrink-0" />
                    }
                  </div>

                  {/* Diff */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <div className="bg-danger/5 border border-danger/15 rounded p-3">
                      <p className="font-dm-mono text-xs text-danger mb-1">Avant</p>
                      <p className="font-dm-sans text-sm text-text-primary">{c.ancien || '—'}</p>
                    </div>
                    <div className="bg-success/5 border border-success/15 rounded p-3">
                      <p className="font-dm-mono text-xs text-success mb-1">Après</p>
                      <p className="font-dm-sans text-sm text-text-primary">{c.nouveau || '—'}</p>
                    </div>
                  </div>

                  {/* Expanded: AI recommendation + proposed text */}
                  {isExpanded && (
                    <div className="mt-4 space-y-3 animate-slide-up">
                      {c.recommandation_ia && (
                        <div className="bg-gold/5 border border-gold/20 rounded p-3">
                          <p className="font-dm-mono text-xs text-gold mb-2">Recommandation IA — Loi Doubin</p>
                          <p className="font-dm-sans text-sm text-text-primary leading-relaxed">
                            {c.recommandation_ia}
                          </p>
                        </div>
                      )}
                      {c.proposition_texte && (
                        <div className="bg-bg-elevated border border-border-default rounded p-3">
                          <p className="font-dm-mono text-xs text-text-secondary mb-2">Reformulation légale proposée</p>
                          <p className="font-dm-sans text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                            {c.proposition_texte}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Level 1: per-change approve/reject buttons */}
                  {automationLevel === 1 && (
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-subtle">
                      <button
                        onClick={() => toggleApprove(c.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm font-dm-sans transition-all duration-200 border ${
                          isApproved
                            ? 'bg-success/15 border-success/40 text-success'
                            : 'border-border-subtle text-text-secondary hover:border-success/40 hover:text-success'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" /> Approuver
                      </button>
                      <button
                        onClick={() => toggleReject(c.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm font-dm-sans transition-all duration-200 border ${
                          isRejected
                            ? 'bg-danger/10 border-danger/30 text-danger'
                            : 'border-border-subtle text-text-secondary hover:border-danger/30 hover:text-danger'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rejeter
                      </button>
                    </div>
                  )}

                  {/* Level 2: individual toggle still allowed */}
                  {automationLevel === 2 && (
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-subtle">
                      <button
                        onClick={() => toggleApprove(c.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-dm-sans transition-all duration-200 border ${
                          isApproved
                            ? 'bg-success/15 border-success/40 text-success'
                            : 'border-border-subtle text-text-secondary hover:border-success/40 hover:text-success'
                        }`}
                      >
                        <Check className="w-3 h-3" /> {isApproved ? 'Approuvé' : 'Approuver'}
                      </button>
                      <button
                        onClick={() => toggleReject(c.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-dm-sans transition-all duration-200 border ${
                          isRejected
                            ? 'bg-danger/10 border-danger/30 text-danger'
                            : 'border-border-subtle text-text-secondary hover:border-danger/30 hover:text-danger'
                        }`}
                      >
                        <XCircle className="w-3 h-3" /> Rejeter
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom action bar */}
        {changements.length > 0 && (
          <div className="sticky bottom-6 card border-border-default bg-bg-card/90 backdrop-blur-sm shadow-xl">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                {automationLevel === 1 && (
                  <p className="font-dm-sans text-sm text-text-secondary">
                    {approvedIds.size} approuvé(s) · {rejectedIds.size} rejeté(s) · {pendingDecision} en attente
                  </p>
                )}
                {automationLevel === 2 && (
                  <p className="font-dm-sans text-sm text-text-secondary">
                    {approvedIds.size} / {changements.length} changements sélectionnés
                  </p>
                )}
              </div>
              <button
                onClick={handleFinalApprove}
                disabled={approveMutation.isPending || (automationLevel === 1 && approvedIds.size === 0 && rejectedIds.size === 0)}
                className="btn-liquid-glass-prominent flex-shrink-0"
              >
                {approveMutation.isPending ? <LoadingSpinner size="sm" /> : <CheckCircle className="w-4 h-4" />}
                Valider la nouvelle version
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Upload form ── */
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <PageHeader
        title="Importer un DIP"
        subtitle="Uploadez votre Document d'Information Précontractuelle au format PDF ou DOCX. L'IA analysera automatiquement les changements par rapport à la version précédente."
      />

      <div className="space-y-5">
        {/* Drop zone */}
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
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-gold/10 border border-gold/20 animate-glow">
                {step === 'uploading'
                  ? <LoadingSpinner size="md" />
                  : <Sparkles className="w-7 h-7 text-gold animate-pulse" />
                }
              </div>
              <div>
                <p className="font-dm-sans text-sm font-medium text-text-primary">
                  {step === 'uploading' ? 'Upload en cours…' : 'Analyse IA en cours…'}
                </p>
                <p className="font-dm-sans text-xs text-text-secondary mt-1">
                  {step === 'uploading'
                    ? 'Envoi du fichier vers le serveur'
                    : 'Claude compare les versions et détecte les changements légaux — jusqu\'à 60s'
                  }
                </p>
              </div>
              <div className="w-48 h-1 bg-bg-elevated rounded-full mx-auto overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full animate-pulse"
                  style={{ width: step === 'analyzing' ? '70%' : '30%', transition: 'width 2s ease' }}
                />
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
                <p className="font-dm-sans text-xs text-text-secondary mt-1">PDF ou DOCX, max 20 Mo</p>
              </div>
              <span className="inline-block font-dm-sans text-xs text-gold border border-gold/30 rounded px-3 py-1">
                Parcourir les fichiers
              </span>
            </div>
          )}
        </div>

        {file && step === 'idle' && (
          <div className="animate-slide-up">
            <label className="label">Titre du document</label>
            <input
              type="text"
              className="input-field"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="DIP 2025 — Ma Franchise"
            />
          </div>
        )}

        {file && step === 'idle' && (
          <button
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending}
            className="btn-liquid-glass-prominent w-full"
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

        <div className="bg-gold/5 border border-gold/20 rounded p-4">
          <p className="font-dm-mono text-xs text-gold mb-2">Comment ça fonctionne</p>
          <ol className="space-y-1">
            {[
              'Votre fichier est uploadé de manière sécurisée',
              'L\'IA Claude extrait le texte et le compare à la version précédente',
              'Les changements (deltas) sont identifiés section par section',
              'Des reformulations légales conformes Loi Doubin sont proposées',
              'Vous approuvez ou rejetez chaque changement selon votre niveau d\'automatisation'
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-2 font-dm-sans text-xs text-text-secondary">
                <span className="font-dm-mono text-gold/60">{i + 1}.</span> {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
