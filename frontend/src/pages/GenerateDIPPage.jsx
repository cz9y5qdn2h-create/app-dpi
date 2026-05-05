import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusBadge from '../components/ui/StatusBadge';
import toast from 'react-hot-toast';
import {
  ChevronRight, ChevronLeft, Sparkles, Save, Download,
  CheckCircle, AlertTriangle, Building2, Users, Landmark,
  TrendingUp, FileSignature, MapPin, Scale, Calendar, Info
} from 'lucide-react';

const STEPS = [
  { id: 'identite', title: 'Identité', icon: Building2, desc: 'Informations légales du franchiseur' },
  { id: 'historique', title: 'Historique', icon: Calendar, desc: 'Parcours et enseigne' },
  { id: 'reseau', title: 'Réseau', icon: Users, desc: 'État du réseau de franchisés' },
  { id: 'finances', title: 'Finances', icon: TrendingUp, desc: 'Comptes et investissements' },
  { id: 'marque', title: 'Marque & PI', icon: Landmark, desc: 'Propriété intellectuelle' },
  { id: 'contrat', title: 'Contrat', icon: FileSignature, desc: 'Conditions contractuelles' },
  { id: 'territoire', title: 'Territoire', icon: MapPin, desc: 'Zone exclusive' },
  { id: 'litiges', title: 'Litiges', icon: Scale, desc: 'Contentieux passés et en cours' },
];

const INITIAL_FORM = {
  // Section 1 - Identité
  raison_sociale: '', forme_juridique: 'SAS', capital_social: '', rcs_ville: '', rcs_numero: '',
  siege_social: '', dirigeant_nom: '', dirigeant_fonction: 'Président',
  // Section 2 - Historique
  date_creation: '', date_enseigne: '', historique_dirigeant: '', historique_enseigne: '',
  // Section 3 - Réseau
  nb_franchises: '', nb_succursales: '', nb_ouvertures_12m: '', nb_fermetures_12m: '',
  details_fermetures: '',
  // Section 4 - Finances
  ca_n1: '', resultat_n1: '', ca_n2: '', resultat_n2: '',
  // Section 5 - Marque & PI
  marque_nom: '', marque_inpi_numero: '', marque_depot_date: '', marque_validite: '',
  marque_territoire: 'France',
  // Section 6 - Informations financières
  droit_entree: '', redevance_exploitation: '', redevance_pub: '', apport_personnel: '',
  investissement_total: '', conditions_paiement: '',
  // Section 7 - Territoire
  territoire_description: '', territoire_exclusif: 'oui', criteres_zone: '',
  // Section 8 - Contrat
  duree_contrat: '', renouvellement: '', conditions_resiliation: '', conditions_cession: '',
  // Section 9 - Litiges
  litiges_en_cours: 'non', description_litiges: '', litiges_termines: '',
  // Section 10 - Prévisionnels
  previsionnel_description: '',
};

const FORM_FIELDS = {
  identite: [
    { key: 'raison_sociale', label: 'Raison sociale', required: true, placeholder: 'Ma Franchise SAS' },
    { key: 'forme_juridique', label: 'Forme juridique', type: 'select', options: ['SAS', 'SARL', 'SA', 'SNC', 'EURL', 'SCI', 'Autre'] },
    { key: 'capital_social', label: 'Capital social (€)', placeholder: '100 000', type: 'number' },
    { key: 'rcs_numero', label: 'Numéro RCS / SIRET', placeholder: '123 456 789 RCS Paris' },
    { key: 'rcs_ville', label: 'Ville RCS', placeholder: 'Paris' },
    { key: 'siege_social', label: 'Siège social', placeholder: '123 rue de la Paix, 75001 Paris' },
    { key: 'dirigeant_nom', label: 'Nom du dirigeant', required: true, placeholder: 'Jean Dupont' },
    { key: 'dirigeant_fonction', label: 'Fonction du dirigeant', type: 'select', options: ['Président', 'PDG', 'Gérant', 'Directeur Général'] },
  ],
  historique: [
    { key: 'date_creation', label: 'Date de création de la société', type: 'date' },
    { key: 'date_enseigne', label: 'Date de création de l\'enseigne / réseau', type: 'date' },
    { key: 'historique_dirigeant', label: 'Parcours du dirigeant (5 dernières années)', type: 'textarea', placeholder: '2020-2025 : PDG de Ma Franchise SAS. 2018-2020 : Directeur commercial chez...' },
    { key: 'historique_enseigne', label: 'Historique de l\'enseigne', type: 'textarea', placeholder: 'Fondée en 2018, l\'enseigne compte aujourd\'hui X points de vente en France...' },
  ],
  reseau: [
    { key: 'nb_franchises', label: 'Nombre de franchisés actuels', type: 'number', placeholder: '42' },
    { key: 'nb_succursales', label: 'Nombre de succursales', type: 'number', placeholder: '5' },
    { key: 'nb_ouvertures_12m', label: 'Ouvertures sur 12 derniers mois', type: 'number', placeholder: '8' },
    { key: 'nb_fermetures_12m', label: 'Fermetures sur 12 derniers mois', type: 'number', placeholder: '2' },
    { key: 'details_fermetures', label: 'Détail des fermetures / résiliations', type: 'textarea', placeholder: '1 résiliation amiable, 1 non-renouvellement...' },
  ],
  finances: [
    { key: 'ca_n1', label: 'Chiffre d\'affaires N-1 (€)', type: 'number', placeholder: '2 500 000' },
    { key: 'resultat_n1', label: 'Résultat net N-1 (€)', type: 'number', placeholder: '320 000' },
    { key: 'ca_n2', label: 'Chiffre d\'affaires N-2 (€)', type: 'number', placeholder: '2 100 000' },
    { key: 'resultat_n2', label: 'Résultat net N-2 (€)', type: 'number', placeholder: '280 000' },
  ],
  marque: [
    { key: 'marque_nom', label: 'Nom de la marque', placeholder: 'Ma Franchise®' },
    { key: 'marque_inpi_numero', label: 'Numéro de dépôt INPI', placeholder: '4 012 345' },
    { key: 'marque_depot_date', label: 'Date de dépôt INPI', type: 'date' },
    { key: 'marque_validite', label: 'Date de validité', type: 'date' },
    { key: 'marque_territoire', label: 'Territoire de protection', type: 'select', options: ['France', 'Union Européenne', 'International (OMPI)', 'France + UE'] },
  ],
  contrat: [
    { key: 'droit_entree', label: 'Droit d\'entrée HT (€)', type: 'number', placeholder: '20 000' },
    { key: 'redevance_exploitation', label: 'Redevance d\'exploitation (%CA)', placeholder: '5%' },
    { key: 'redevance_pub', label: 'Redevance publicitaire (%CA)', placeholder: '2%' },
    { key: 'apport_personnel', label: 'Apport personnel minimum (€)', type: 'number', placeholder: '50 000' },
    { key: 'investissement_total', label: 'Investissement total estimé (€)', type: 'number', placeholder: '150 000' },
    { key: 'conditions_paiement', label: 'Conditions de paiement', type: 'textarea', placeholder: 'Droit d\'entrée à la signature, redevances mensuelles au 5 du mois...' },
    { key: 'duree_contrat', label: 'Durée du contrat', placeholder: '5 ans renouvelables' },
    { key: 'renouvellement', label: 'Conditions de renouvellement', type: 'textarea', placeholder: 'Renouvellement automatique sauf dénonciation 6 mois avant échéance...' },
    { key: 'conditions_resiliation', label: 'Conditions de résiliation', type: 'textarea', placeholder: 'Résiliation possible en cas de manquement grave non corrigé sous 30 jours...' },
    { key: 'conditions_cession', label: 'Conditions de cession', type: 'textarea', placeholder: 'Cession soumise à agrément préalable du franchiseur...' },
  ],
  territoire: [
    { key: 'territoire_exclusif', label: 'Zone exclusive accordée', type: 'select', options: ['oui', 'non', 'partielle'] },
    { key: 'territoire_description', label: 'Description de la zone', type: 'textarea', placeholder: 'Zone définie par un rayon de 5 km autour du point de vente, dans la commune de...' },
    { key: 'criteres_zone', label: 'Critères de délimitation', type: 'textarea', placeholder: 'Basé sur une population de X habitants, délimitation par les voies...' },
  ],
  litiges: [
    { key: 'litiges_en_cours', label: 'Y a-t-il des litiges en cours ?', type: 'select', options: ['non', 'oui'] },
    { key: 'description_litiges', label: 'Description des litiges en cours', type: 'textarea', placeholder: 'Si oui, décrivez brièvement la nature et l\'état d\'avancement...' },
    { key: 'litiges_termines', label: 'Litiges terminés dans les 5 dernières années', type: 'textarea', placeholder: 'Précisez le nombre, la nature et l\'issue de chaque litige...' },
    { key: 'previsionnel_description', label: 'Comptes prévisionnels — hypothèses et projections', type: 'textarea', placeholder: 'Basé sur un CA prévisionnel de X€ la 1ère année, X€ la 2ème, X€ la 3ème. Hypothèses : taux de redevance X%, coûts fixes X€/an...' },
  ],
};

export default function GenerateDIPPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [result, setResult] = useState(null);
  const [savedDipId, setSavedDipId] = useState(null);

  const generateMutation = useMutation({
    mutationFn: () => api.post('/agent/generate', { formData: form }, { timeout: 120000 }),
    onSuccess: (res) => {
      setResult(res.data);
      toast.success('DIP généré avec succès !');
    },
    onError: (err) => toast.error(err.message)
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post('/dip/create-from-agent', {
      title: form.raison_sociale ? `DIP ${form.raison_sociale}` : 'DIP généré',
      sections: result.sections,
      global_score: result.global_score,
      company_name: form.raison_sociale
    }),
    onSuccess: (res) => {
      setSavedDipId(res.data.dip?.id);
      toast.success('DIP sauvegardé dans votre compte !');
    },
    onError: (err) => toast.error(err.message)
  });

  const downloadDocxMutation = useMutation({
    mutationFn: () => api.post('/agent/docx', {
      sections: result,
      companyName: form.raison_sociale || profile?.company_name
    }, { responseType: 'blob', timeout: 60000 }),
    onSuccess: (res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `DIP_${(form.raison_sociale || 'franchiseur').replace(/[^a-z0-9]/gi, '_')}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('DOCX téléchargé');
    },
    onError: (err) => toast.error(err.message)
  });

  const stepKeys = STEPS.map(s => s.id);
  const currentStepId = stepKeys[currentStep];
  const currentFields = FORM_FIELDS[currentStepId] || [];

  const updateField = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const progress = Math.round(((currentStep + 1) / STEPS.length) * 100);

  if (result) {
    return <ResultView
      result={result}
      form={form}
      savedDipId={savedDipId}
      onSave={() => saveMutation.mutate()}
      onDownload={() => downloadDocxMutation.mutate()}
      onNavigateDip={() => navigate('/dip')}
      isSaving={saveMutation.isPending}
      isDownloading={downloadDocxMutation.isPending}
      onReset={() => { setResult(null); setSavedDipId(null); }}
    />;
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <PageHeader
        title="Générer un DIP"
        subtitle="Renseignez le formulaire — l'IA rédige un DIP complet et conforme Loi Doubin"
      />

      {/* Progression */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <span className="font-dm-sans text-sm text-text-secondary">Étape {currentStep + 1} sur {STEPS.length}</span>
          <span className="font-dm-mono text-sm text-gold">{progress}%</span>
        </div>
        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden mb-5">
          <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STEPS.map((step, i) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-dm-sans transition-all ${
                i === currentStep ? 'bg-gold text-bg-primary' :
                i < currentStep ? 'bg-success/15 text-success border border-success/20' :
                'text-text-muted hover:text-text-secondary'
              }`}
            >
              {i < currentStep && <CheckCircle className="w-3 h-3" />}
              <step.icon className="w-3 h-3" />
              {step.title}
            </button>
          ))}
        </div>
      </div>

      {/* Formulaire de l'étape courante */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          {(() => { const S = STEPS[currentStep]; return <S.icon className="w-5 h-5 text-gold" />; })()}
          <div>
            <h2 className="font-cormorant text-xl text-text-primary">{STEPS[currentStep].title}</h2>
            <p className="font-dm-sans text-xs text-text-secondary">{STEPS[currentStep].desc}</p>
          </div>
        </div>

        <div className="space-y-4">
          {currentFields.map(field => (
            <div key={field.key}>
              <label className="label">
                {field.label}
                {field.required && <span className="text-danger ml-1">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  className="input-field resize-none min-h-24"
                  value={form[field.key]}
                  onChange={e => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder || ''}
                />
              ) : field.type === 'select' ? (
                <select
                  className="input-field"
                  value={form[field.key]}
                  onChange={e => updateField(field.key, e.target.value)}
                >
                  {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  className="input-field"
                  type={field.type || 'text'}
                  value={form[field.key]}
                  onChange={e => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder || ''}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border-subtle">
          <button
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="btn-ghost flex items-center gap-2 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" /> Précédent
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={() => setCurrentStep(s => s + 1)}
              className="btn-primary flex items-center gap-2"
            >
              Suivant <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="btn-liquid-glass-prominent flex items-center gap-2"
            >
              {generateMutation.isPending ? (
                <><LoadingSpinner size="sm" /> Génération en cours (30-60s)...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Générer le DIP</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-gold/5 border border-gold/15">
        <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
        <p className="font-dm-sans text-xs text-text-secondary leading-relaxed">
          Les champs non renseignés seront signalés comme "À compléter" dans le DIP généré.
          Plus vous renseignez de champs, plus le DIP sera complet et conforme à la Loi Doubin.
        </p>
      </div>
    </div>
  );
}

function ResultView({ result, form, savedDipId, onSave, onDownload, onNavigateDip, isSaving, isDownloading, onReset }) {
  const conformes = result.sections?.filter(s => s.status === 'conforme').length || 0;
  const totalSections = result.sections?.length || 10;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="DIP Généré"
        subtitle={`Score de conformité : ${result.global_score || 0}% — ${conformes}/${totalSections} sections conformes`}
      />

      {/* Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={onSave}
          disabled={isSaving || !!savedDipId}
          className={`btn-liquid-glass flex-col py-4 gap-2 h-auto ${savedDipId ? 'opacity-50' : ''}`}
        >
          {isSaving ? <LoadingSpinner size="sm" /> : <Save className="w-5 h-5" />}
          <span className="text-xs">{savedDipId ? 'Sauvegardé ✓' : 'Sauvegarder'}</span>
        </button>

        <button
          onClick={onDownload}
          disabled={isDownloading}
          className="btn-liquid-glass flex-col py-4 gap-2 h-auto"
        >
          {isDownloading ? <LoadingSpinner size="sm" /> : <Download className="w-5 h-5" />}
          <span className="text-xs">Télécharger DOCX</span>
        </button>

        {savedDipId && (
          <button onClick={onNavigateDip} className="btn-liquid-glass-prominent flex-col py-4 gap-2 h-auto">
            <CheckCircle className="w-5 h-5" />
            <span className="text-xs">Voir le DIP</span>
          </button>
        )}

        <button onClick={onReset} className="btn-ghost flex-col py-4 gap-2 h-auto">
          <span className="text-xs">Nouveau formulaire</span>
        </button>
      </div>

      {/* Résumé */}
      {result.summary && (
        <div className="card border-gold/15 bg-gold/3">
          <p className="font-dm-sans text-sm text-text-secondary leading-relaxed">{result.summary}</p>
        </div>
      )}

      {/* Données manquantes */}
      {result.missing_data?.length > 0 && (
        <div className="card border-danger/15 bg-danger/3">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-danger" />
            <span className="font-dm-sans text-sm font-medium text-danger">Informations manquantes à compléter</span>
          </div>
          <ul className="space-y-1">
            {result.missing_data.map((item, i) => (
              <li key={i} className="font-dm-sans text-xs text-text-secondary flex items-start gap-2">
                <span className="text-danger mt-0.5">•</span> {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sections générées */}
      <div className="space-y-3">
        {(result.sections || []).map(section => (
          <div key={section.section_number} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-dm-mono text-xs text-gold/60 w-6">{section.section_number}</span>
                <h3 className="font-dm-sans text-sm font-medium text-text-primary">{section.section_title}</h3>
              </div>
              <StatusBadge status={section.status} />
            </div>
            <div className="font-dm-sans text-sm text-text-secondary leading-relaxed bg-bg-elevated rounded-lg p-4 whitespace-pre-wrap">
              {section.content}
            </div>
            {section.suggestions?.length > 0 && (
              <div className="mt-3 space-y-1">
                {section.suggestions.map((s, i) => (
                  <p key={i} className="font-dm-sans text-xs text-gold/70 flex items-start gap-1.5">
                    <span className="mt-0.5">→</span> {s}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
