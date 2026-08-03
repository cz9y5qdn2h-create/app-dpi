import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import RedlineView from '../components/RedlineView';
import {
  ChevronLeft, ChevronRight, Edit3, Check, X, AlertCircle,
  ArrowLeft, FileText, ScrollText, Download, Paperclip, Trash2,
  ChevronDown, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const SECTION_DESCRIPTIONS = [
  '',
  'Raison sociale, forme juridique, capital, dirigeants, RCS, adresse du siège social, domiciliation bancaire.',
  'Date de création de l\'enseigne, historique du dirigeant sur les 5 dernières années, état général et LOCAL du marché avec perspectives de développement (R.330-1, 4°).',
  'Nombre de franchisés, implantations, ouvertures et fermetures des 2 dernières années, présence d\'un concurrent autorisé dans la zone, résultats réels des sites pilotes.',
  'Comptes annuels des 2 derniers exercices (bilan, compte de résultat).',
  'Marques déposées, brevets, savoir-faire protégé, durée de protection (ou durée de la licence si la marque est concédée et non cédée).',
  'Droits d\'entrée, redevances, CA moyen des franchisés, tableaux financiers.',
  'Zone d\'exclusivité territoriale, conditions de modification.',
  'Durée du contrat, conditions de renouvellement, de résiliation et clause de non-concurrence post-contractuelle.',
  'Litiges en cours et survenus dans les 5 dernières années.',
  'Comptes prévisionnels d\'un point de vente type.',
];

const STATUS_LABEL = { conforme: 'Conforme', a_verifier: 'À vérifier', non_conforme: 'Non conforme' };

async function downloadBlob(path, filename) {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DIPAvocatPage() {
  const { franchiseurId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('dip');
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const { data: dipData, isLoading: dipLoading, isError: dipError } = useQuery({
    queryKey: ['avocat', 'dip', franchiseurId],
    queryFn: () => api.get(`/avocat/franchiseur/${franchiseurId}/dip`).then(r => r.data),
  });

  const { data: contractData, isLoading: contractLoading } = useQuery({
    queryKey: ['avocat', 'contract', franchiseurId],
    queryFn: () => api.get(`/avocat/franchiseur/${franchiseurId}/contract`).then(r => r.data),
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['avocat', 'dashboard'],
    queryFn: () => api.get('/avocat/dashboard').then(r => r.data),
  });
  const clients = dashboardData?.franchiseurs || [];

  if (dipLoading) {
    return (
      <div data-theme="sobre" className="min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--bg-primary))' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (dipError) {
    return (
      <div data-theme="sobre" className="min-h-screen flex flex-col items-center justify-center gap-4 text-center" style={{ background: 'rgb(var(--bg-primary))' }}>
        <AlertCircle className="w-10 h-10 text-danger/50" />
        <p className="display-v2" style={{ fontSize: 28 }}>Accès refusé</p>
        <Link to="/dashboard" className="btn-cta-glow">
          <ArrowLeft className="w-4 h-4" /> Retour au dashboard
        </Link>
      </div>
    );
  }

  const { dip, franchiseur } = dipData;
  const contract = contractData?.contract || null;

  return (
    <div data-theme="sobre" className="min-h-screen -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8" style={{ background: 'rgb(var(--bg-primary))' }}>
      <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
        {/* En-tête : retour + sélecteur de client */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link to="/dashboard" className="flex items-center gap-1.5 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            <ArrowLeft className="w-4 h-4" /> Tableau de bord
          </Link>

          <div className="relative">
            <button
              onClick={() => setSwitcherOpen(v => !v)}
              className="card-v2 flex items-center gap-2 py-2 px-3"
              style={{ cursor: 'pointer' }}
            >
              <Building2 className="w-4 h-4" style={{ color: 'var(--v2-gold)' }} />
              <span className="font-dm-sans text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{franchiseur?.company_name}</span>
              <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgb(var(--text-muted))' }} />
            </button>
            {switcherOpen && (
              <div className="absolute right-0 mt-2 w-64 card-v2 z-20 py-1" style={{ background: 'rgb(var(--bg-card))' }}>
                {clients.map(c => (
                  <button
                    key={c.franchiseur_id}
                    onClick={() => { setSwitcherOpen(false); navigate(`/dip/avocat/${c.franchiseur_id}`); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-dm-sans hover:bg-white/5 transition-colors flex items-center justify-between gap-2"
                    style={{ color: c.franchiseur_id === franchiseurId ? 'var(--v2-gold)' : 'rgb(var(--text-primary))' }}
                  >
                    <span className="truncate">{c.franchiseur?.company_name || c.franchiseur_id}</span>
                    {typeof c.latestDip?.conformity_score === 'number' && (
                      <span className="mono-label-v2" style={{ fontSize: 10 }}>{c.latestDip.conformity_score}%</span>
                    )}
                  </button>
                ))}
                {clients.length === 0 && (
                  <p className="px-3 py-2 text-xs font-dm-sans" style={{ color: 'rgb(var(--text-muted))' }}>Aucun autre client</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="mono-label-v2">Espace avocat</p>
          <p className="display-v2" style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>{franchiseur?.company_name || 'Dossier franchiseur'}</p>
        </div>

        {/* Onglets */}
        <div className="flex gap-2">
          {[
            { key: 'dip', label: 'DIP', icon: FileText },
            { key: 'contrat', label: 'Contrat de franchise', icon: ScrollText },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-dm-sans transition-all"
              style={tab === key
                ? { background: 'var(--v2-gold)', color: '#0a0805', fontWeight: 600 }
                : { background: 'var(--v2-surface)', border: '1px solid var(--v2-border)', color: 'rgb(var(--text-secondary))' }}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === 'dip' && (
          dip
            ? <SlideDeck mode="dip" dip={dip} franchiseurId={franchiseurId} franchiseur={franchiseur} />
            : <EmptyState label="Ce franchiseur n'a pas encore de DIP actif." />
        )}

        {tab === 'contrat' && (
          contractLoading
            ? <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
            : contract
              ? <SlideDeck mode="contract" contract={contract} franchiseurId={franchiseurId} franchiseur={franchiseur} />
              : <EmptyState label="Ce franchiseur n'a pas encore de contrat actif." />
        )}
      </div>
    </div>
  );
}

function HistoryItem({ proposal: p }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-xs font-dm-sans">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 text-left">
        <ChevronDown className="w-3 h-3 flex-shrink-0 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none', color: 'rgb(var(--text-muted))' }} />
        <span style={{ color: p.status === 'accepted' ? 'rgb(91 216 154)' : 'rgb(241 124 124)' }}>
          {p.status === 'accepted' ? '✓ Acceptée' : '✗ Rejetée'}
        </span>
        <span style={{ color: 'rgb(var(--text-muted))' }}>{formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: fr })}</span>
      </button>
      {open && (
        <div className="mt-2 mb-1 ml-5 rounded-lg p-3" style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-border)' }}>
          <RedlineView before={p.content_before ?? ''} after={p.content_proposed} className="text-xs" />
          {p.reviewer_comment && (
            <p className="mt-2 pt-2 italic" style={{ borderTop: '1px solid var(--v2-border)', color: 'rgb(var(--text-muted))' }}>
              « {p.reviewer_comment} »
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="card-v2 text-center py-16">
      <FileText className="w-10 h-10 mx-auto mb-4" style={{ color: 'rgb(var(--text-muted))' }} />
      <p className="font-dm-sans text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{label}</p>
    </div>
  );
}

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

function SlideDeck({ mode, dip, contract, franchiseurId, franchiseur }) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const isDip = mode === 'dip';
  const items = isDip
    ? (dip?.dip_sections || []).slice().sort((a, b) => a.section_number - b.section_number)
    : (contract?.contract_clauses || []).slice().sort((a, b) => a.clause_number - b.clause_number);

  const proposalsQueryKey = isDip ? ['avocat', 'dip', franchiseurId] : ['avocat', 'contract', franchiseurId];
  const { data } = useQuery({
    queryKey: proposalsQueryKey,
    queryFn: () => api.get(`/avocat/franchiseur/${franchiseurId}/${isDip ? 'dip' : 'contract'}`).then(r => r.data),
  });
  const proposals = data?.proposals || [];

  const current = items[index];
  const currentProposals = isDip
    ? proposals.filter(p => p.section_id === current?.id)
    : proposals.filter(p => p.clause_id === current?.id);
  const pendingProposal = currentProposals.find(p => p.status === 'pending');
  const reviewedProposals = currentProposals.filter(p => p.status !== 'pending').slice(0, 3);

  const proposeMutation = useMutation({
    mutationFn: ({ content }) => isDip
      ? api.post(`/avocat/sections/${current.id}/propose`, { content, dip_id: dip.id })
      : api.post(`/avocat/clauses/${current.id}/propose`, { content, contract_id: contract.id }),
    onSuccess: () => {
      toast.success('Proposition envoyée au franchiseur');
      queryClient.invalidateQueries({ queryKey: proposalsQueryKey });
      setIsEditing(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const goTo = useCallback((next) => {
    if (next < 0 || next >= items.length) return;
    setDir(next > index ? 1 : -1);
    setIndex(next);
    setIsEditing(false);
  }, [index, items.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (isEditing) return;
      if (e.key === 'ArrowRight') goTo(index + 1);
      if (e.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, isEditing, goTo]);

  const handleDownload = async () => {
    try {
      if (isDip) await downloadBlob(`/export/${dip.id}/document-pdf`, `DIP_${(dip.title || 'document').replace(/[^a-z0-9]/gi, '_')}.pdf`);
      else await downloadBlob(`/contracts/${contract.id}/pdf`, `Contrat_${(contract.title || 'franchise').replace(/[^a-z0-9]/gi, '_')}.pdf`);
      toast.success('PDF téléchargé');
    } catch {
      toast.error('Impossible de générer le PDF');
    }
  };

  if (!current) return <EmptyState label="Aucune section disponible." />;

  const title = isDip ? current.section_title : current.clause_title;
  const number = isDip ? current.section_number : current.clause_number;
  const globalScore = isDip ? dip.conformity_score : contract.conformity_score;

  return (
    <div className="space-y-4">
      {/* Barre de progression + score global */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1.5 gap-0.5">
            <p className="mono-label-v2">Trame {index + 1} / {items.length}</p>
            <p className="mono-label-v2">Conformité globale — {globalScore}%</p>
          </div>
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--v2-border)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((index + 1) / items.length) * 100}%`, background: 'var(--v2-gold)' }} />
          </div>
        </div>
        <button onClick={handleDownload} className="btn-cta-glow text-xs py-2 px-4 flex-shrink-0 justify-center">
          <Download className="w-3.5 h-3.5" /> Export PDF
        </button>
      </div>

      {/* Navigation rapide */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {items.map((it, i) => {
          const status = it.status;
          return (
            <button
              key={it.id}
              onClick={() => goTo(i)}
              title={isDip ? it.section_title : it.clause_title}
              className="flex-shrink-0 w-8 h-8 rounded-lg text-xs font-dm-mono flex items-center justify-center transition-all"
              style={{
                background: i === index ? 'var(--v2-gold)' : 'var(--v2-surface)',
                border: `1px solid ${i === index ? 'var(--v2-gold)' : 'var(--v2-border)'}`,
                color: i === index ? '#0a0805' : status === 'non_conforme' ? 'rgb(241 124 124)' : status === 'a_verifier' ? 'var(--v2-gold)' : 'rgb(91 216 154)',
                fontWeight: i === index ? 700 : 400,
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Trame */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={current.id}
          custom={dir}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: 'easeInOut' }}
          className="slide-v2"
        >
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div>
              <p className="mono-label-v2 mb-1">{isDip ? 'Section' : 'Clause'} {number}</p>
              <p className="display-v2" style={{ fontSize: 'clamp(22px, 3vw, 32px)' }}>{title}</p>
            </div>
            <span
              className="section-card-v2-label px-2.5 py-1 rounded-full flex-shrink-0"
              data-status={current.status}
              style={{ border: '1px solid currentColor' }}
            >
              {STATUS_LABEL[current.status] || current.status}
            </span>
          </div>

          {isDip && SECTION_DESCRIPTIONS[number] && (
            <p className="font-dm-sans text-xs italic mb-4 pl-3" style={{ color: 'rgb(var(--text-muted))', borderLeft: '2px solid var(--v2-border)' }}>
              {SECTION_DESCRIPTIONS[number]}
            </p>
          )}

          {pendingProposal && (
            <div className="mb-4 px-3 py-2 rounded-lg font-dm-mono text-xs" style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid var(--v2-border-hot)', color: 'var(--v2-gold)' }}>
              Proposition en attente de validation par le franchiseur — suivi des modifications ci-dessous
            </div>
          )}

          {!isEditing ? (
            <>
              <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--v2-surface)', minHeight: 120 }}>
                {pendingProposal ? (
                  <RedlineView
                    before={pendingProposal.content_before ?? current.content ?? ''}
                    after={pendingProposal.content_proposed}
                    className="font-dm-sans text-sm"
                  />
                ) : (
                  <p className="font-dm-sans text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'rgb(var(--text-primary))' }}>
                    {current.content || <span style={{ color: 'rgb(var(--text-muted))' }} className="italic">Non renseigné</span>}
                  </p>
                )}
              </div>
              <button
                onClick={() => { setIsEditing(true); setEditContent(current.content || ''); }}
                disabled={!!pendingProposal}
                className="btn-cta-glow text-sm"
                style={pendingProposal ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
              >
                <Edit3 className="w-4 h-4" /> Modifier cette trame
              </button>
            </>
          ) : (
            <div className="space-y-3 mb-4">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full rounded-xl p-4 font-dm-sans text-sm resize-y"
                style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-border-hot)', color: 'rgb(var(--text-primary))', minHeight: 180 }}
                autoFocus
              />

              <div>
                <p className="mono-label-v2 mb-1.5">Suivi des modifications</p>
                <div className="rounded-xl p-4" style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-border)', minHeight: 80 }}>
                  <RedlineView before={current.content || ''} after={editContent} className="font-dm-sans text-sm" emptyLabel="Commencez à rédiger pour voir l'aperçu." />
                </div>
              </div>

              <p className="font-dm-sans text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                Le franchiseur devra valider cette modification avant qu'elle s'applique au document.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => proposeMutation.mutate({ content: editContent })}
                  disabled={!editContent.trim() || proposeMutation.isPending}
                  className="btn-cta-glow text-sm"
                >
                  {proposeMutation.isPending ? <LoadingSpinner size="sm" /> : <Check className="w-4 h-4" />} Envoyer la proposition
                </button>
                <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 text-sm font-dm-sans px-4 py-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                  <X className="w-4 h-4" /> Annuler
                </button>
              </div>
            </div>
          )}

          {reviewedProposals.length > 0 && (
            <div className="pt-3 mb-4" style={{ borderTop: '1px solid var(--v2-border)' }}>
              <p className="mono-label-v2 mb-2">Historique</p>
              <div className="space-y-1.5">
                {reviewedProposals.map(p => <HistoryItem key={p.id} proposal={p} />)}
              </div>
            </div>
          )}

          <AnnexManager
            targetType={isDip ? 'section' : 'clause'}
            targetId={current.id}
            dipId={isDip ? dip.id : undefined}
            contractId={isDip ? undefined : contract.id}
            ownerId={franchiseur?.id}
          />
        </motion.div>
      </AnimatePresence>

      {/* Navigation précédent/suivant */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="flex items-center gap-2 text-sm font-dm-sans px-4 py-2 rounded-full"
          style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-border)', color: 'rgb(var(--text-secondary))', opacity: index === 0 ? 0.4 : 1 }}
        >
          <ChevronLeft className="w-4 h-4" /> Précédent
        </button>
        <button
          onClick={() => goTo(index + 1)}
          disabled={index === items.length - 1}
          className="flex items-center gap-2 text-sm font-dm-sans px-4 py-2 rounded-full"
          style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-border)', color: 'rgb(var(--text-secondary))', opacity: index === items.length - 1 ? 0.4 : 1 }}
        >
          Suivant <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function AnnexManager({ targetType, targetId, dipId, contractId, ownerId }) {
  const queryClient = useQueryClient();
  const annexPath = `/avocat/${targetType === 'section' ? 'sections' : 'clauses'}/${targetId}/annexes`;
  const queryKey = ['annexes', targetType, targetId];

  const { data } = useQuery({
    queryKey,
    queryFn: () => api.get(annexPath).then(r => r.data),
  });
  const annexes = data?.annexes || [];

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const parentId = dipId || contractId;
      const storage_path = `${ownerId}/${parentId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('dip-annexes')
        .upload(storage_path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'application/octet-stream' });
      if (uploadError) throw new Error('Upload impossible : ' + uploadError.message);

      return api.post(annexPath, {
        dip_id: dipId,
        contract_id: contractId,
        file_name: file.name,
        storage_path,
        size_bytes: file.size,
      });
    },
    onSuccess: () => {
      toast.success('Annexe ajoutée');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/avocat/annexes/${id}`),
    onSuccess: () => {
      toast.success('Annexe supprimée');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(err.message),
  });

  const onDrop = useCallback((accepted) => {
    accepted.forEach(file => uploadMutation.mutate(file));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dipId, contractId, ownerId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 25 * 1024 * 1024,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    onDropRejected: (files) => {
      const err = files[0]?.errors[0];
      if (err?.code === 'file-too-large') toast.error('Fichier trop volumineux (max 25 Mo)');
      else toast.error('Format non supporté (PDF, DOCX, DOC, PNG, JPG)');
    },
  });

  const handleAnnexDownload = async (annexe) => {
    try {
      const { data: signed } = await supabase.storage.from('dip-annexes').createSignedUrl(annexe.storage_path, 300);
      if (signed?.signedUrl) window.open(signed.signedUrl, '_blank');
    } catch {
      toast.error('Téléchargement impossible');
    }
  };

  return (
    <div className="pt-3" style={{ borderTop: '1px solid var(--v2-border)' }}>
      <p className="mono-label-v2 mb-2 flex items-center gap-1.5"><Paperclip className="w-3 h-3" /> Annexes</p>

      {annexes.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {annexes.map(a => (
            <div key={a.id} className="flex items-center justify-between gap-2 text-xs font-dm-sans px-3 py-2 rounded-lg" style={{ background: 'var(--v2-surface)' }}>
              <button onClick={() => handleAnnexDownload(a)} className="truncate flex-1 text-left hover:underline" style={{ color: 'rgb(var(--text-primary))' }}>
                {a.file_name}
              </button>
              <button onClick={() => deleteMutation.mutate(a.id)} title="Supprimer" style={{ color: 'rgb(var(--text-muted))' }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div {...getRootProps()} className="dropzone-v2" data-active={isDragActive}>
        <input {...getInputProps()} />
        <p className="font-dm-sans text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
          {uploadMutation.isPending ? 'Envoi en cours…' : isDragActive ? 'Déposez ici…' : 'Glissez-déposez un fichier, ou cliquez pour parcourir'}
        </p>
      </div>
    </div>
  );
}
