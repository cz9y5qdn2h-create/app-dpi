import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Upload, ChevronDown, ChevronUp, Edit3, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const SECTION_DESCRIPTIONS = [
  '',
  'Raison sociale, forme juridique, capital, dirigeants, RCS, SIREN, adresse du siège social.',
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

export default function DIPPage() {
  const queryClient = useQueryClient();
  const [expandedSection, setExpandedSection] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [editContent, setEditContent] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['dips'],
    queryFn: () => api.get('/dip').then(r => r.data)
  });

  const updateMutation = useMutation({
    mutationFn: ({ dipId, sectionId, content, status }) =>
      api.put(`/dip/${dipId}/sections/${sectionId}`, { content, status }),
    onSuccess: () => {
      toast.success('Section mise à jour');
      queryClient.invalidateQueries({ queryKey: ['dips'] });
      setEditingSection(null);
    },
    onError: (err) => toast.error(err.message)
  });

  const dip = data?.dips?.[0];
  const sections = dip?.dip_sections?.sort((a, b) => a.section_number - b.section_number) || [];

  if (isLoading) {
    return <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>;
  }

  if (!dip) {
    return (
      <div className="text-center py-24">
        <p className="font-dm-sans text-text-secondary mb-6">Aucun DIP importé</p>
        <Link to="/dip/upload" className="btn-primary inline-flex items-center gap-2">
          <Upload className="w-4 h-4" /> Importer mon DIP
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={dip.title}
        subtitle={`Score de conformité : ${dip.conformity_score}% • ${sections.length} sections`}
        action={
          <Link to="/dip/upload" className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" /> Mettre à jour
          </Link>
        }
      />

      {/* Barre de progression globale */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="font-dm-sans text-sm text-text-secondary">Conformité globale</span>
          <span className="font-dm-mono text-sm text-gold">{dip.conformity_score}%</span>
        </div>
        <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gold transition-all duration-700"
            style={{ width: `${dip.conformity_score}%` }}
          />
        </div>
        <div className="flex gap-6 mt-4">
          {[
            { label: 'Conformes', key: 'conforme', color: 'text-success' },
            { label: 'À vérifier', key: 'a_verifier', color: 'text-gold' },
            { label: 'Non conformes', key: 'non_conforme', color: 'text-danger' },
          ].map(({ label, key, color }) => (
            <div key={key}>
              <p className={`font-cormorant text-2xl ${color}`}>
                {sections.filter(s => s.status === key).length}
              </p>
              <p className="font-dm-sans text-xs text-text-secondary">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map(section => (
          <SectionAccordion
            key={section.id}
            section={section}
            dipId={dip.id}
            description={SECTION_DESCRIPTIONS[section.section_number] || ''}
            isExpanded={expandedSection === section.id}
            onToggle={() => setExpandedSection(
              expandedSection === section.id ? null : section.id
            )}
            isEditing={editingSection === section.id}
            editContent={editContent}
            onEdit={() => { setEditingSection(section.id); setEditContent(section.content || ''); }}
            onEditChange={setEditContent}
            onSave={(status) => updateMutation.mutate({
              dipId: dip.id, sectionId: section.id, content: editContent, status
            })}
            onCancelEdit={() => setEditingSection(null)}
            isSaving={updateMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function SectionAccordion({
  section, dipId, description, isExpanded, onToggle,
  isEditing, editContent, onEdit, onEditChange, onSave, onCancelEdit, isSaving
}) {
  return (
    <div className={`card transition-all duration-300 ${
      isExpanded ? 'border-border-default' : 'hover:border-border-default cursor-pointer'
    }`}>
      {/* En-tête */}
      <div className="flex items-center gap-4" onClick={isEditing ? undefined : onToggle}>
        <span className="font-dm-mono text-sm text-gold/60 w-6 flex-shrink-0">
          {String(section.section_number).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-dm-sans text-sm text-text-primary font-medium">
            {section.section_title}
          </p>
          {description && (
            <p className="font-dm-sans text-xs text-text-secondary mt-0.5 hidden sm:block">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={section.status} />
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-text-secondary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          )}
        </div>
      </div>

      {/* Contenu déployé */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border-subtle animate-slide-up">
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                className="input-field min-h-48 resize-none font-dm-mono text-sm"
                value={editContent}
                onChange={e => onEditChange(e.target.value)}
                placeholder="Contenu de la section..."
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onSave('conforme')}
                  disabled={isSaving}
                  className="btn-primary flex items-center gap-2 text-sm py-2"
                >
                  {isSaving ? <LoadingSpinner size="sm" /> : <Check className="w-4 h-4" />}
                  Valider comme conforme
                </button>
                <button
                  onClick={() => onSave('a_verifier')}
                  disabled={isSaving}
                  className="btn-secondary flex items-center gap-2 text-sm py-2"
                >
                  Enregistrer
                </button>
                <button onClick={onCancelEdit} className="btn-ghost flex items-center gap-2 text-sm">
                  <X className="w-4 h-4" /> Annuler
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="bg-bg-elevated rounded p-4 mb-4">
                <pre className="font-dm-sans text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                  {section.content || <span className="text-text-secondary">Contenu non renseigné</span>}
                </pre>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-dm-mono text-xs text-text-secondary">
                  Mis à jour le {section.last_updated
                    ? new Date(section.last_updated).toLocaleDateString('fr-FR')
                    : 'N/A'
                  }
                </p>
                <button onClick={onEdit} className="btn-ghost flex items-center gap-2 text-sm">
                  <Edit3 className="w-4 h-4" /> Modifier
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
