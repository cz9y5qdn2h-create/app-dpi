import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  Upload, ChevronDown, ChevronUp, Edit3, Check, X,
  Sparkles, Download, FileText, Plus, Trash2, AlertCircle,
  Share2, Copy, Link2Off, Eye, BarChart2
} from 'lucide-react';
import toast from 'react-hot-toast';
import ProposalsPanel from '../components/ProposalsPanel';

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

const STEPS = [
  { id: 1, label: 'Identité & Historique', desc: 'Sections 1–2' },
  { id: 2, label: 'Réseau & Comptes',      desc: 'Sections 3–4' },
  { id: 3, label: 'Marque, Finances & Contrat', desc: 'Sections 5–9' },
  { id: 4, label: 'Prévisionnels',          desc: 'Section 10' },
];

const emptyForm = () => ({
  identite: { raison_sociale: '', forme_juridique: 'SAS', capital: '', rcs_numero: '', rcs_ville: '', siege_social: '', dirigeants: [{ nom: '', fonction: 'Président' }] },
  historique: { date_creation_societe: '', date_creation_enseigne: '', parcours_dirigeant: '' },
  reseau: { nb_franchises: '', nb_succursales: '', ouvertures_12mois: '', fermetures_12mois: '' },
  comptes: { exercice_n1: { annee: new Date().getFullYear() - 1, ca: '', resultat: '' }, exercice_n2: { annee: new Date().getFullYear() - 2, ca: '', resultat: '' } },
  marque: { nom_marque: '', inpi_numero: '', inpi_date: '', territoire: 'France' },
  financier: { droit_entree: '', redevance_exploitation_pct: '', redevance_publicitaire_pct: '', investissement_total: '' },
  territoire: { type_exclusivite: 'exclusive', description: '', perimetre_km: '' },
  contrat: { duree_ans: '', renouvellement: '', resiliation_conditions: '' },
  litiges: { attestation_absence: true, details: '' },
  previsionnels: { an1: { ca: '', charges: '' }, an2: { ca: '', charges: '' }, an3: { ca: '', charges: '' }, hypotheses: '' },
});

export default function DIPPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [tab, setTab] = useState('view');
  const [expandedSection, setExpandedSection] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(emptyForm());
  const [generating, setGenerating] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [importingXlsx, setImportingXlsx] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);

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

  const dip = data?.dips?.find(d => d.status === 'actif') ?? data?.dips?.[0];
  const sections = dip?.dip_sections?.sort((a, b) => a.section_number - b.section_number) || [];

  const set = (path, value) => {
    const keys = path.split('.');
    setFormData(prev => {
      const next = structuredClone(prev);
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/agent/generate', { formData }, { timeout: 180000 });
      toast.success('DIP généré — sauvegarde en cours…');

      const sectionsGenerated = res.data.sections || [];
      if (!dip) {
        const { data: newDip } = await api.post('/dip/create-from-agent', {
          sections: sectionsGenerated,
          global_score: res.data.global_score,
          title: `DIP ${formData.identite.raison_sociale || 'Franchiseur'} — ${new Date().getFullYear()}`,
          company_name: formData.identite.raison_sociale,
        }).catch(() => ({ data: null }));
        if (newDip) toast.success('DIP enregistré avec succès');
      }

      queryClient.invalidateQueries({ queryKey: ['dips'] });
      setTab('view');
      toast.success(`${sectionsGenerated.length} sections générées — score ${res.data.global_score}%`);
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateShareLink = async () => {
    if (!dip) return;
    setShareLoading(true);
    try {
      const res = await api.post(`/dip/${dip.id}/share-link`);
      queryClient.invalidateQueries({ queryKey: ['dips'] });
      toast.success('Lien de partage généré');
      return res.data;
    } catch (err) {
      toast.error('Impossible de générer le lien');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShareLink = async () => {
    if (!dip) return;
    setShareLoading(true);
    try {
      await api.delete(`/dip/${dip.id}/share-link`);
      queryClient.invalidateQueries({ queryKey: ['dips'] });
      toast.success('Lien révoqué — les franchisés n\'y ont plus accès');
    } catch (err) {
      toast.error('Impossible de révoquer le lien');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!dip?.share_token) return;
    const url = `${window.location.origin}/dip/partage/${dip.share_token}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Lien copié dans le presse-papiers'));
  };

  const handleDownloadXlsx = async () => {
    if (!dip) return;
    setDownloadingXlsx(true);
    try {
      const res = await api.get(`/export/${dip.id}/xlsx`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DIP_${(profile?.company_name || 'Franchiseur').replace(/[^a-z0-9]/gi, '_')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel téléchargé');
    } catch {
      toast.error('Impossible de générer le fichier Excel');
    } finally {
      setDownloadingXlsx(false);
    }
  };

  const handleImportXlsx = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !dip) return;
    setImportingXlsx(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/export/${dip.id}/import-xlsx`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`${res.data.updated} section(s) mises à jour depuis l'Excel`);
      queryClient.invalidateQueries({ queryKey: ['dips'] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'import Excel');
    } finally {
      setImportingXlsx(false);
      e.target.value = '';
    }
  };

  const handleDownloadDocx = async () => {
    if (!dip) return;
    setDownloadingDocx(true);
    try {
      const res = await api.post('/agent/docx', {
        sections: { sections, global_score: dip.conformity_score, summary: dip.title },
        companyName: profile?.company_name || dip.title
      }, { responseType: 'blob', timeout: 60000 });

      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DIP_${(profile?.company_name || 'Franchiseur').replace(/[^a-z0-9]/gi, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('DOCX téléchargé');
    } catch (err) {
      toast.error('Impossible de générer le DOCX');
    } finally {
      setDownloadingDocx(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>;

  if (!dip && tab === 'view') {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
        <PageHeader title="Mon DIP" subtitle="Importez ou générez votre Document d'Information Précontractuelle" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link to="/dip/upload" className="card hover:border-gold/40 transition-all cursor-pointer group text-center py-8">
            <Upload className="w-8 h-8 text-gold mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <p className="font-dm-sans text-sm font-medium text-text-primary">Importer un DIP</p>
            <p className="font-dm-sans text-xs text-text-secondary mt-1">PDF ou DOCX existant</p>
          </Link>
          <button onClick={() => setTab('generate')} className="card hover:border-gold/40 transition-all cursor-pointer group text-center py-8">
            <Sparkles className="w-8 h-8 text-gold mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <p className="font-dm-sans text-sm font-medium text-text-primary">Générer avec l'IA</p>
            <p className="font-dm-sans text-xs text-text-secondary mt-1">Remplir un formulaire</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={dip?.title || 'Mon DIP'}
        subtitle={dip ? `Score de conformité : ${dip.conformity_score}% • ${sections.length} sections` : 'Générer votre DIP'}
        action={
          dip && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleDownloadDocx}
                disabled={downloadingDocx}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {downloadingDocx ? <LoadingSpinner size="sm" /> : <Download className="w-4 h-4" />}
                DOCX
              </button>
              <button
                onClick={handleDownloadXlsx}
                disabled={downloadingXlsx}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {downloadingXlsx ? <LoadingSpinner size="sm" /> : <Download className="w-4 h-4" />}
                Excel
              </button>
              <label className="btn-secondary flex items-center gap-2 text-sm cursor-pointer">
                {importingXlsx ? <LoadingSpinner size="sm" /> : <Plus className="w-4 h-4" />}
                Import Excel
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleImportXlsx}
                  disabled={importingXlsx}
                  className="sr-only"
                />
              </label>
              <button
                onClick={() => setShowSharePanel(v => !v)}
                className={`btn-secondary flex items-center gap-2 text-sm ${showSharePanel ? 'border-gold/40 text-gold' : ''}`}
              >
                <Share2 className="w-4 h-4" />
                Partager
                {dip.share_token && (
                  <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" title="Lien actif" />
                )}
              </button>
              <Link to={`/analytics/dip/${dip.id}`} className="btn-secondary flex items-center gap-2 text-sm">
                <BarChart2 className="w-4 h-4" /> Analytics
              </Link>
              <Link to="/dip/upload" className="btn-secondary flex items-center gap-2 text-sm">
                <Upload className="w-4 h-4" /> Mettre à jour
              </Link>
            </div>
          )
        }
      />

      {/* Panneau de partage franchisés */}
      {showSharePanel && (
        <div className="card border-gold/20 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <Share2 className="w-4 h-4 text-gold" />
            <p className="font-dm-sans text-sm font-medium text-text-primary">Portail franchisé — partage sécurisé</p>
          </div>
          <p className="font-dm-sans text-xs text-text-secondary mb-4">
            Générez un lien unique pour permettre à vos franchisés de consulter ce DIP en lecture seule, sans créer de compte.
            Vous pouvez révoquer l'accès à tout moment.
          </p>

          {dip.share_token ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-bg-elevated rounded-lg px-3 py-2">
                <Link2Off className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />
                <span className="font-dm-mono text-xs text-text-primary truncate flex-1">
                  {window.location.origin}/dip/partage/{dip.share_token}
                </span>
                <button onClick={handleCopyShareLink} className="btn-ghost p-1 flex-shrink-0" title="Copier le lien">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-dm-sans text-xs text-text-secondary">
                  <Eye className="w-3.5 h-3.5" />
                  {dip.share_token_views || 0} consultation{(dip.share_token_views || 0) !== 1 ? 's' : ''}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCopyShareLink} className="btn-primary flex items-center gap-2 text-xs py-1.5 px-3">
                    <Copy className="w-3.5 h-3.5" /> Copier le lien
                  </button>
                  <button
                    onClick={handleRevokeShareLink}
                    disabled={shareLoading}
                    className="btn-ghost flex items-center gap-2 text-xs text-danger hover:text-danger/80"
                  >
                    {shareLoading ? <LoadingSpinner size="sm" /> : <Link2Off className="w-3.5 h-3.5" />}
                    Révoquer l'accès
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerateShareLink}
              disabled={shareLoading}
              className="btn-liquid-glass-prominent flex items-center gap-2 text-sm"
            >
              {shareLoading ? <LoadingSpinner size="sm" /> : <Share2 className="w-4 h-4" />}
              Générer le lien de partage
            </button>
          )}
        </div>
      )}

      {/* Panel propositions avocat — visible uniquement pour le franchiseur */}
      {dip && <ProposalsPanel dipId={dip.id} />}

      {/* Onglets */}
      <div className="flex gap-1 bg-bg-elevated rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('view')}
          className={`px-4 py-2 rounded text-sm font-dm-sans transition-all ${
            tab === 'view' ? 'bg-gold/20 text-gold font-medium' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Vue DIP</span>
        </button>
        <button
          onClick={() => setTab('generate')}
          className={`px-4 py-2 rounded text-sm font-dm-sans transition-all ${
            tab === 'generate' ? 'bg-gold/20 text-gold font-medium' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> Générer avec l'IA</span>
        </button>
      </div>

      {/* ── Onglet Vue DIP ─────────────────────────────────────────── */}
      {tab === 'view' && dip && (
        <>
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

          <div className="space-y-3">
            {sections.map(section => (
              <SectionAccordion
                key={section.id}
                section={section}
                dipId={dip.id}
                description={SECTION_DESCRIPTIONS[section.section_number] || ''}
                isExpanded={expandedSection === section.id}
                onToggle={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                isEditing={editingSection === section.id}
                editContent={editContent}
                onEdit={() => { setEditingSection(section.id); setEditContent(section.content || ''); }}
                onEditChange={setEditContent}
                onSave={(status) => updateMutation.mutate({ dipId: dip.id, sectionId: section.id, content: editContent, status })}
                onCancelEdit={() => setEditingSection(null)}
                isSaving={updateMutation.isPending}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Onglet Générer avec l'IA ───────────────────────────────── */}
      {tab === 'generate' && (
        <div className="space-y-6">
          {generating && (
            <div className="card border-gold/20 text-center py-12">
              <Sparkles className="w-10 h-10 text-gold animate-pulse mx-auto mb-4" />
              <p className="font-cormorant text-2xl text-text-primary">Claude génère votre DIP…</p>
              <p className="font-dm-sans text-sm text-text-secondary mt-2">Analyse juridique en cours (30–60 secondes)</p>
              <div className="w-48 h-1 bg-bg-elevated rounded-full mx-auto mt-6 overflow-hidden">
                <div className="h-full bg-gold rounded-full animate-pulse" style={{ width: '70%' }} />
              </div>
            </div>
          )}

          {!generating && (
            <>
              {/* Stepper */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {STEPS.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setStep(s.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-dm-sans transition-all ${
                        step === s.id
                          ? 'bg-gold/20 border border-gold/40 text-gold'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        step > s.id ? 'bg-gold text-bg-primary' : step === s.id ? 'bg-gold/20 text-gold border border-gold/40' : 'bg-bg-elevated text-text-secondary'
                      }`}>{step > s.id ? '✓' : s.id}</span>
                      <span className="hidden sm:block">{s.label}</span>
                    </button>
                    {i < STEPS.length - 1 && <div className="w-4 h-px bg-border-subtle flex-shrink-0" />}
                  </div>
                ))}
              </div>

              <div className="card">
                <p className="font-dm-mono text-xs text-gold mb-4 uppercase tracking-widest">{STEPS[step - 1].label}</p>

                {/* Étape 1 — Identité & Historique */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Raison sociale *" value={formData.identite.raison_sociale} onChange={v => set('identite.raison_sociale', v)} placeholder="PIZZA VILLAGE SAS" />
                      <div>
                        <label className="label">Forme juridique</label>
                        <select className="input-field" value={formData.identite.forme_juridique} onChange={e => set('identite.forme_juridique', e.target.value)}>
                          {['SAS', 'SARL', 'SA', 'SNC', 'EURL', 'SCI', 'EI'].map(f => <option key={f}>{f}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Capital (€)" type="number" value={formData.identite.capital} onChange={v => set('identite.capital', v)} placeholder="50000" />
                      <Field label="N° RCS" value={formData.identite.rcs_numero} onChange={v => set('identite.rcs_numero', v)} placeholder="123 456 789" />
                      <Field label="Ville RCS" value={formData.identite.rcs_ville} onChange={v => set('identite.rcs_ville', v)} placeholder="Paris" />
                    </div>
                    <Field label="Siège social (adresse complète)" value={formData.identite.siege_social} onChange={v => set('identite.siege_social', v)} placeholder="123 rue de la Paix, 75001 Paris" />

                    <div className="space-y-2">
                      <label className="label">Dirigeants</label>
                      {formData.identite.dirigeants.map((d, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input className="input-field flex-1" placeholder="Nom Prénom" value={d.nom} onChange={e => { const arr = [...formData.identite.dirigeants]; arr[i].nom = e.target.value; set('identite.dirigeants', arr); }} />
                          <input className="input-field w-36" placeholder="Fonction" value={d.fonction} onChange={e => { const arr = [...formData.identite.dirigeants]; arr[i].fonction = e.target.value; set('identite.dirigeants', arr); }} />
                          {i > 0 && <button onClick={() => set('identite.dirigeants', formData.identite.dirigeants.filter((_, j) => j !== i))} className="text-danger hover:text-danger/70 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      ))}
                      <button onClick={() => set('identite.dirigeants', [...formData.identite.dirigeants, { nom: '', fonction: '' }])} className="btn-ghost text-xs flex items-center gap-1 mt-1">
                        <Plus className="w-3 h-3" /> Ajouter un dirigeant
                      </button>
                    </div>

                    <div className="border-t border-border-subtle pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Date création société" type="date" value={formData.historique.date_creation_societe} onChange={v => set('historique.date_creation_societe', v)} />
                      <Field label="Date création enseigne" type="date" value={formData.historique.date_creation_enseigne} onChange={v => set('historique.date_creation_enseigne', v)} />
                    </div>
                    <TextArea label="Parcours du dirigeant (5 ans minimum)" value={formData.historique.parcours_dirigeant} onChange={v => set('historique.parcours_dirigeant', v)} placeholder="2019–2024 : PDG de Pizza Village SAS. Avant : 10 ans dans la restauration rapide dont 5 ans comme directeur régional chez…" rows={4} />
                  </div>
                )}

                {/* Étape 2 — Réseau & Comptes */}
                {step === 2 && (
                  <div className="space-y-4">
                    <p className="font-dm-sans text-xs text-text-secondary mb-2">État actuel du réseau de franchisés</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <Field label="Nb franchisés" type="number" value={formData.reseau.nb_franchises} onChange={v => set('reseau.nb_franchises', v)} placeholder="45" />
                      <Field label="Nb succursales" type="number" value={formData.reseau.nb_succursales} onChange={v => set('reseau.nb_succursales', v)} placeholder="3" />
                      <Field label="Ouvertures (12 mois)" type="number" value={formData.reseau.ouvertures_12mois} onChange={v => set('reseau.ouvertures_12mois', v)} placeholder="5" />
                      <Field label="Fermetures (12 mois)" type="number" value={formData.reseau.fermetures_12mois} onChange={v => set('reseau.fermetures_12mois', v)} placeholder="1" />
                    </div>

                    <div className="border-t border-border-subtle pt-4">
                      <p className="font-dm-sans text-xs text-text-secondary mb-3">Comptes annuels — 2 derniers exercices</p>
                      {[
                        { key: 'exercice_n1', label: `Exercice N-1 (${formData.comptes.exercice_n1.annee})` },
                        { key: 'exercice_n2', label: `Exercice N-2 (${formData.comptes.exercice_n2.annee})` },
                      ].map(({ key, label }) => (
                        <div key={key} className="mb-4">
                          <p className="font-dm-mono text-xs text-gold mb-2">{label}</p>
                          <div className="grid grid-cols-3 gap-3">
                            <Field label="Année" type="number" value={formData.comptes[key].annee} onChange={v => set(`comptes.${key}.annee`, v)} />
                            <Field label="CA (€)" type="number" value={formData.comptes[key].ca} onChange={v => set(`comptes.${key}.ca`, v)} placeholder="2 500 000" />
                            <Field label="Résultat net (€)" type="number" value={formData.comptes[key].resultat} onChange={v => set(`comptes.${key}.resultat`, v)} placeholder="180 000" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Étape 3 — Marque, Finances & Contrat */}
                {step === 3 && (
                  <div className="space-y-4">
                    <p className="font-dm-mono text-xs text-gold uppercase tracking-widest mb-2">Marque & Propriété intellectuelle</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Nom de la marque" value={formData.marque.nom_marque} onChange={v => set('marque.nom_marque', v)} placeholder="PIZZA VILLAGE" />
                      <Field label="N° dépôt INPI" value={formData.marque.inpi_numero} onChange={v => set('marque.inpi_numero', v)} placeholder="4234567" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Date dépôt INPI" type="date" value={formData.marque.inpi_date} onChange={v => set('marque.inpi_date', v)} />
                      <Field label="Territoire de protection" value={formData.marque.territoire} onChange={v => set('marque.territoire', v)} placeholder="France, UE" />
                    </div>

                    <div className="border-t border-border-subtle pt-4">
                      <p className="font-dm-mono text-xs text-gold uppercase tracking-widest mb-2">Informations financières</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Field label="Droit d'entrée (€)" type="number" value={formData.financier.droit_entree} onChange={v => set('financier.droit_entree', v)} placeholder="15000" />
                        <Field label="Redevance exploit. (%)" type="number" value={formData.financier.redevance_exploitation_pct} onChange={v => set('financier.redevance_exploitation_pct', v)} placeholder="5" />
                        <Field label="Redevance pub. (%)" type="number" value={formData.financier.redevance_publicitaire_pct} onChange={v => set('financier.redevance_publicitaire_pct', v)} placeholder="2" />
                        <Field label="Investissement total (€)" type="number" value={formData.financier.investissement_total} onChange={v => set('financier.investissement_total', v)} placeholder="120000" />
                      </div>
                    </div>

                    <div className="border-t border-border-subtle pt-4">
                      <p className="font-dm-mono text-xs text-gold uppercase tracking-widest mb-2">Territoire & Contrat</p>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="label">Type de territoire</label>
                          <select className="input-field" value={formData.territoire.type_exclusivite} onChange={e => set('territoire.type_exclusivite', e.target.value)}>
                            <option value="exclusive">Zone exclusive</option>
                            <option value="non_exclusive">Zone non exclusive</option>
                          </select>
                        </div>
                        <Field label="Durée du contrat (ans)" type="number" value={formData.contrat.duree_ans} onChange={v => set('contrat.duree_ans', v)} placeholder="7" />
                      </div>
                      <Field label="Description de la zone territoriale" value={formData.territoire.description} onChange={v => set('territoire.description', v)} placeholder="Zone de chalandise de 30 000 habitants autour du point de vente" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                        <Field label="Conditions de renouvellement" value={formData.contrat.renouvellement} onChange={v => set('contrat.renouvellement', v)} placeholder="Renouvelable par tacite reconduction pour 5 ans" />
                        <Field label="Conditions de résiliation" value={formData.contrat.resiliation_conditions} onChange={v => set('contrat.resiliation_conditions', v)} placeholder="Résiliation possible avec préavis de 6 mois…" />
                      </div>
                    </div>

                    <div className="border-t border-border-subtle pt-4">
                      <p className="font-dm-mono text-xs text-gold uppercase tracking-widest mb-2">Litiges</p>
                      <label className="flex items-center gap-3 cursor-pointer mb-3">
                        <input type="checkbox" checked={formData.litiges.attestation_absence} onChange={e => set('litiges.attestation_absence', e.target.checked)} className="rounded" />
                        <span className="font-dm-sans text-sm text-text-primary">Attestation d'absence de litige (aucun litige en cours ou passé)</span>
                      </label>
                      {!formData.litiges.attestation_absence && (
                        <TextArea label="Détail des litiges" value={formData.litiges.details} onChange={v => set('litiges.details', v)} placeholder="Procédure en cours devant le TGI de Paris depuis 2023 — demandeur : M. Dupont, franchisé à Lyon…" rows={3} />
                      )}
                    </div>
                  </div>
                )}

                {/* Étape 4 — Prévisionnels */}
                {step === 4 && (
                  <div className="space-y-4">
                    <p className="font-dm-sans text-xs text-text-secondary mb-2">Comptes prévisionnels pour un point de vente type sur 3 ans</p>
                    {[
                      { key: 'an1', label: 'Année 1' },
                      { key: 'an2', label: 'Année 2' },
                      { key: 'an3', label: 'Année 3' },
                    ].map(({ key, label }) => {
                      const ca = Number(formData.previsionnels[key].ca) || 0;
                      const charges = Number(formData.previsionnels[key].charges) || 0;
                      const resultat = ca - charges;
                      return (
                        <div key={key} className="bg-bg-elevated rounded-lg p-4">
                          <p className="font-dm-mono text-xs text-gold mb-3">{label}</p>
                          <div className="grid grid-cols-3 gap-3">
                            <Field label="CA prévisionnel (€)" type="number" value={formData.previsionnels[key].ca} onChange={v => set(`previsionnels.${key}.ca`, v)} placeholder="400 000" />
                            <Field label="Charges totales (€)" type="number" value={formData.previsionnels[key].charges} onChange={v => set(`previsionnels.${key}.charges`, v)} placeholder="320 000" />
                            <div>
                              <label className="label">Résultat net</label>
                              <p className={`font-dm-mono text-base mt-2 ${resultat >= 0 ? 'text-success' : 'text-danger'}`}>
                                {resultat >= 0 ? '+' : ''}{resultat.toLocaleString('fr-FR')} €
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <TextArea label="Hypothèses et conditions de réalisation *" value={formData.previsionnels.hypotheses} onChange={v => set('previsionnels.hypotheses', v)} placeholder="Ces projections sont établies sur la base d'un emplacement prime en zone commerciale avec un flux piéton de 5 000 personnes/jour, une équipe de 3 salariés ETP, et un ticket moyen de 12 €…" rows={5} />

                    <div className="bg-gold/5 border border-gold/20 rounded-lg p-4 flex gap-3">
                      <AlertCircle className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                      <p className="font-dm-sans text-xs text-text-secondary">Ces prévisionnels sont fournis à titre indicatif. Ils doivent être établis par un expert-comptable pour valeur légale.</p>
                    </div>
                  </div>
                )}

                {/* Navigation stepper */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border-subtle">
                  <button
                    onClick={() => setStep(s => Math.max(1, s - 1))}
                    disabled={step === 1}
                    className="btn-ghost text-sm disabled:opacity-30"
                  >
                    ← Précédent
                  </button>

                  {step < 4 ? (
                    <button onClick={() => setStep(s => Math.min(4, s + 1))} className="btn-liquid-glass text-sm">
                      Suivant →
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerate}
                      disabled={generating || !formData.identite.raison_sociale}
                      className="btn-liquid-glass-prominent flex items-center gap-2 text-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      Générer le DIP avec l'IA
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input-field" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder = '', rows = 3 }) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea rows={rows} className="input-field resize-none" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function SectionAccordion({ section, dipId, description, isExpanded, onToggle, isEditing, editContent, onEdit, onEditChange, onSave, onCancelEdit, isSaving }) {
  return (
    <div className={`card transition-all duration-300 ${isExpanded ? 'border-border-default' : 'hover:border-border-default cursor-pointer'}`}>
      <div className="flex items-center gap-4" onClick={isEditing ? undefined : onToggle}>
        <span className="font-dm-mono text-sm text-gold/60 w-6 flex-shrink-0">{String(section.section_number).padStart(2, '0')}</span>
        <div className="flex-1 min-w-0">
          <p className="font-dm-sans text-sm text-text-primary font-medium">{section.section_title}</p>
          {description && <p className="font-dm-sans text-xs text-text-secondary mt-0.5 hidden sm:block">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={section.status} />
          {isExpanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border-subtle animate-slide-up">
          {isEditing ? (
            <div className="space-y-3">
              <textarea className="input-field min-h-48 resize-none font-dm-mono text-sm" value={editContent} onChange={e => onEditChange(e.target.value)} placeholder="Contenu de la section..." />
              <div className="flex items-center gap-3">
                <button onClick={() => onSave('conforme')} disabled={isSaving} className="btn-primary flex items-center gap-2 text-sm py-2">
                  {isSaving ? <LoadingSpinner size="sm" /> : <Check className="w-4 h-4" />} Valider comme conforme
                </button>
                <button onClick={() => onSave('a_verifier')} disabled={isSaving} className="btn-secondary flex items-center gap-2 text-sm py-2">Enregistrer</button>
                <button onClick={onCancelEdit} className="btn-ghost flex items-center gap-2 text-sm"><X className="w-4 h-4" /> Annuler</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="bg-bg-elevated rounded p-4 mb-4">
                <pre className="font-dm-sans text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                  {section.content || <span className="text-text-secondary italic">Contenu non renseigné</span>}
                </pre>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-dm-mono text-xs text-text-secondary">
                  Mis à jour le {section.last_updated ? new Date(section.last_updated).toLocaleDateString('fr-FR') : 'N/A'}
                </p>
                <button onClick={onEdit} className="btn-ghost flex items-center gap-2 text-sm"><Edit3 className="w-4 h-4" /> Modifier</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
