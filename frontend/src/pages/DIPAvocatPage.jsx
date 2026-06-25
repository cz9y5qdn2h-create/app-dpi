import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  ChevronDown, ChevronUp, Edit3, Check, X, AlertCircle,
  ArrowLeft, Clock, FileText, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const SECTION_DESCRIPTIONS = [
  '',
  'Raison sociale, forme juridique, capital, dirigeants, RCS, adresse du siège social.',
  'Date de création de l\'enseigne, historique du dirigeant sur les 5 dernières années.',
  'Nombre de franchisés, implantations, ouvertures et fermetures des 2 dernières années.',
  'Comptes annuels des 2 derniers exercices (bilan, compte de résultat).',
  'Marques déposées, brevets, savoir-faire protégé, durée de protection.',
  'Droits d\'entrée, redevances, CA moyen des franchisés, tableaux financiers.',
  'Zone d\'exclusivité territoriale, conditions de modification.',
  'Durée du contrat, conditions de renouvellement et de résiliation.',
  'Litiges en cours et survenus dans les 5 dernières années.',
  'Comptes prévisionnels d\'un point de vente type.'
];

export default function DIPAvocatPage() {
  const { franchiseurId } = useParams();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [expandedSection, setExpandedSection] = useState(null);
  const [proposingSection, setProposingSection] = useState(null);
  const [proposalContent, setProposalContent] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['avocat', 'dip', franchiseurId],
    queryFn: () => api.get(`/avocat/franchiseur/${franchiseurId}/dip`).then(r => r.data),
  });

  const proposeMutation = useMutation({
    mutationFn: ({ sectionId, content }) =>
      api.post(`/avocat/sections/${sectionId}/propose`, { content, dip_id: data?.dip?.id }),
    onSuccess: () => {
      toast.success('Proposition envoyée au franchiseur');
      queryClient.invalidateQueries({ queryKey: ['avocat', 'dip', franchiseurId] });
      setProposingSection(null);
      setProposalContent('');
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>;

  if (isError || (!isLoading && !data?.dip)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-danger/50" />
        <p className="font-cormorant text-xl text-text-primary">
          {isError ? 'Accès refusé ou DIP introuvable' : 'Ce franchiseur n\'a pas encore de DIP actif'}
        </p>
        <Link to="/dashboard" className="btn-ghost text-sm flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Retour au dashboard
        </Link>
      </div>
    );
  }

  const { dip, franchiseur, proposals } = data;
  const sections = (dip?.dip_sections || []).sort((a, b) => a.section_number - b.section_number);

  const proposalBySectionId = {};
  (proposals || []).forEach(p => {
    if (!proposalBySectionId[p.section_id]) proposalBySectionId[p.section_id] = [];
    proposalBySectionId[p.section_id].push(p);
  });

  const pendingCount = (proposals || []).filter(p => p.status === 'pending').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <Link to="/dashboard" className="btn-ghost text-sm flex items-center gap-1.5 p-1.5">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-text-muted font-dm-sans text-sm">/</span>
        <span className="font-dm-sans text-sm text-text-secondary">{franchiseur?.company_name}</span>
      </div>

      <PageHeader
        title={dip?.title || `DIP — ${franchiseur?.company_name}`}
        subtitle={`Score de conformité : ${dip?.conformity_score}% • ${sections.length} sections${pendingCount > 0 ? ` • ${pendingCount} proposition${pendingCount > 1 ? 's' : ''} en attente` : ''}`}
      />

      {/* Synthèse conformité */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="font-dm-sans text-sm text-text-secondary">Conformité globale</span>
          <span className="font-dm-mono text-sm text-gold">{dip.conformity_score}%</span>
        </div>
        <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gold transition-all duration-700" style={{ width: `${dip.conformity_score}%` }} />
        </div>
        <div className="flex gap-6 mt-4">
          {[
            { label: 'Conformes', key: 'conforme', color: 'text-success' },
            { label: 'À vérifier', key: 'a_verifier', color: 'text-gold' },
            { label: 'Non conformes', key: 'non_conforme', color: 'text-danger' },
          ].map(({ label, key, color }) => (
            <div key={key}>
              <p className={`font-cormorant text-2xl ${color}`}>{sections.filter(s => s.status === key).length}</p>
              <p className="font-dm-sans text-xs text-text-secondary">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map(section => {
          const sectionProposals = proposalBySectionId[section.id] || [];
          const pendingProposal = sectionProposals.find(p => p.status === 'pending');
          const isProposing = proposingSection === section.id;
          const isExpanded = expandedSection === section.id;

          return (
            <div key={section.id} className="card">
              {/* En-tête de section */}
              <div
                className="flex items-center justify-between gap-3 cursor-pointer"
                onClick={() => setExpandedSection(isExpanded ? null : section.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-dm-mono text-xs w-6 flex-shrink-0 text-gold/50">
                    {section.section_number}
                  </span>
                  <div className="min-w-0">
                    <p className="font-dm-sans text-sm font-medium text-text-primary truncate">
                      {section.section_title}
                    </p>
                    {section.last_edited_by && (
                      <p className="font-dm-mono text-xs text-text-muted flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        Modifié {formatDistanceToNow(new Date(section.last_edited_at), { addSuffix: true, locale: fr })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pendingProposal && (
                    <span className="font-dm-mono text-xs text-gold bg-gold/10 border border-gold/20 rounded-full px-2 py-0.5">
                      Proposition en attente
                    </span>
                  )}
                  <StatusBadge status={section.status} />
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                </div>
              </div>

              {/* Contenu étendu */}
              {isExpanded && (
                <div className="mt-4 space-y-4">
                  {SECTION_DESCRIPTIONS[section.section_number] && (
                    <p className="font-dm-sans text-xs text-text-muted italic border-l-2 border-gold/20 pl-3">
                      {SECTION_DESCRIPTIONS[section.section_number]}
                    </p>
                  )}

                  {/* Contenu actuel */}
                  {!isProposing && (
                    <>
                      <div className="bg-bg-elevated rounded-lg p-4">
                        <p className="font-dm-sans text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                          {section.content || <span className="text-text-muted italic">Section non renseignée</span>}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProposingSection(section.id);
                            setProposalContent(section.content || '');
                          }}
                          disabled={!!pendingProposal}
                          className="btn-ghost flex items-center gap-2 text-sm"
                          style={{ color: pendingProposal ? 'rgb(var(--text-muted))' : 'rgb(var(--gold))' }}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {pendingProposal ? 'Proposition en cours de validation' : 'Proposer une modification'}
                        </button>
                      </div>
                    </>
                  )}

                  {/* Formulaire de proposition */}
                  {isProposing && (
                    <div className="space-y-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 text-gold">
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="font-dm-sans text-sm font-medium">Votre proposition de modification</span>
                      </div>
                      <textarea
                        value={proposalContent}
                        onChange={e => setProposalContent(e.target.value)}
                        className="input-field w-full min-h-40 font-dm-sans text-sm resize-y"
                        placeholder="Rédigez ici le contenu proposé pour cette section…"
                        autoFocus
                      />
                      <p className="font-dm-sans text-xs text-text-muted">
                        Le franchiseur recevra une notification et devra valider cette modification avant qu'elle soit appliquée.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => proposeMutation.mutate({ sectionId: section.id, content: proposalContent })}
                          disabled={!proposalContent.trim() || proposeMutation.isPending}
                          className="btn-primary flex items-center gap-2 text-sm py-2"
                        >
                          {proposeMutation.isPending
                            ? <LoadingSpinner size="sm" />
                            : <Check className="w-3.5 h-3.5" />}
                          Envoyer la proposition
                        </button>
                        <button
                          onClick={() => { setProposingSection(null); setProposalContent(''); }}
                          className="btn-ghost flex items-center gap-2 text-sm py-2"
                        >
                          <X className="w-3.5 h-3.5" /> Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Historique des propositions de cette section */}
                  {sectionProposals.filter(p => p.status !== 'pending').length > 0 && (
                    <div className="border-t border-border-subtle pt-3">
                      <p className="font-dm-sans text-xs text-text-muted mb-2 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Historique
                      </p>
                      <div className="space-y-2">
                        {sectionProposals.filter(p => p.status !== 'pending').slice(0, 3).map(p => (
                          <div key={p.id} className="flex items-center gap-2 text-xs">
                            <span className={`font-dm-mono ${p.status === 'accepted' ? 'text-success' : 'text-danger'}`}>
                              {p.status === 'accepted' ? '✓ Acceptée' : '✗ Rejetée'}
                            </span>
                            <span className="text-text-muted">
                              {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: fr })}
                            </span>
                            {p.reviewer_comment && (
                              <span className="text-text-muted italic truncate">— {p.reviewer_comment}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
