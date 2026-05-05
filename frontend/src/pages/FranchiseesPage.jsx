import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  Plus, Users, Edit3, Trash2, Send, X, Check,
  AlertCircle, MessageCircle, Mail, Copy, ExternalLink, Upload, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  name: '', email: '', territory: '',
  contract_start: '', contract_end: '', status: 'actif',
  whatsapp_number: '', phone: ''
};

function waLink(number, message) {
  const clean = (number || '').replace(/\D/g, '');
  if (!clean) return null;
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

function mailtoLink(email, subject, body) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function FranchiseesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvError, setCsvError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['franchisees'],
    queryFn: () => api.get('/franchisees').then(r => r.data)
  });

  const { data: dipsData } = useQuery({
    queryKey: ['dips'],
    queryFn: () => api.get('/dip').then(r => r.data)
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/franchisees', d),
    onSuccess: () => {
      toast.success('Franchisé ajouté');
      queryClient.invalidateQueries({ queryKey: ['franchisees'] });
      setShowForm(false);
      setForm(EMPTY_FORM);
      setFormError('');
    },
    onError: (err) => toast.error(err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }) => api.put('/franchisees/' + id, d),
    onSuccess: () => {
      toast.success('Franchisé mis à jour');
      queryClient.invalidateQueries({ queryKey: ['franchisees'] });
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFormError('');
    },
    onError: (err) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete('/franchisees/' + id),
    onSuccess: () => {
      toast.success('Franchisé supprimé');
      queryClient.invalidateQueries({ queryKey: ['franchisees'] });
    },
    onError: (err) => toast.error(err.message)
  });

  const csvImportMutation = useMutation({
    mutationFn: (rows) => api.post('/franchisees/import-csv', { rows }),
    onSuccess: (res) => {
      toast.success(`${res.data.imported} franchisé(s) importé(s) avec succès`);
      queryClient.invalidateQueries({ queryKey: ['franchisees'] });
      setShowCsvModal(false);
      setCsvPreview([]);
    },
    onError: (err) => toast.error(err.message)
  });

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { setCsvError('Le fichier doit contenir au moins une ligne de données + en-tête.'); return; }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/['"]/g, ''));
          return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
        }).filter(r => r.name || r.nom || r.email);
        if (rows.length === 0) { setCsvError('Aucune ligne valide trouvée.'); return; }
        setCsvPreview(rows);
      } catch { setCsvError('Erreur de lecture du fichier CSV.'); }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const franchisees = data?.franchisees || [];
  const actifs = franchisees.filter(f => f.status === 'actif');
  const dip = dipsData?.dips?.find(d => d.status === 'actif') ?? dipsData?.dips?.[0];

  const defaultMessage = dip
    ? `Bonjour, votre franchiseur vous informe d'une mise à jour du Document d'Information Précontractuelle (DIP).\n\nDIP concerné : ${dip.title || 'DIP en vigueur'}\nScore de conformité : ${dip.conformity_score || 0}%\n\nMerci de prendre connaissance de cette mise à jour. Pour toute question, n'hésitez pas à nous contacter.\n\nCordialement,\nVotre franchiseur`
    : `Bonjour, votre franchiseur vous informe d'une mise à jour du Document d'Information Précontractuelle (DIP).\n\nMerci de prendre connaissance de cette mise à jour.\n\nCordialement,\nVotre franchiseur`;

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (form.contract_start && form.contract_end && form.contract_start > form.contract_end) {
      return setFormError('La date de fin doit être après la date de début');
    }
    if (editingId) updateMutation.mutate({ id: editingId, ...form });
    else createMutation.mutate(form);
  };

  const openEdit = (f) => {
    setEditingId(f.id);
    setForm({
      name: f.name, email: f.email,
      territory: f.territory || '',
      contract_start: f.contract_start ? f.contract_start.split('T')[0] : '',
      contract_end: f.contract_end ? f.contract_end.split('T')[0] : '',
      status: f.status || 'actif',
      whatsapp_number: f.whatsapp_number || '',
      phone: f.phone || ''
    });
    setShowForm(false);
    setFormError('');
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const openNotifyModal = () => {
    setNotifyMsg(defaultMessage);
    setShowNotifyModal(true);
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(notifyMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Message copié');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Franchisés"
        subtitle={`${franchisees.length} franchisé(s) — ${actifs.length} actif(s)`}
        action={
          <div className="flex gap-3">
            {actifs.length > 0 && (
              <button onClick={openNotifyModal} className="btn-secondary flex items-center gap-2">
                <Send className="w-4 h-4" /> Notifier
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCsvModal(true)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Upload className="w-4 h-4" /> Import CSV
              </button>
              <button
                onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); setFormError(''); }}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>
          </div>
        }
      />

      {/* Formulaire créer / modifier */}
      {(showForm || editingId) && (
        <div className="card border-border-default animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-cormorant text-xl">{editingId ? 'Modifier le franchisé' : 'Ajouter un franchisé'}</h3>
            <button onClick={cancelForm} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
          </div>

          {formError && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 text-danger rounded p-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nom complet *</label>
              <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jean Dupont" required />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input-field" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jean@franchise.fr" required />
            </div>
            <div>
              <label className="label">Territoire</label>
              <input className="input-field" value={form.territory} onChange={e => setForm(f => ({ ...f, territory: e.target.value }))} placeholder="Paris 15e" />
            </div>
            <div>
              <label className="label">Statut</label>
              <select className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="actif">Actif</option>
                <option value="en_cours">En cours de démarrage</option>
                <option value="inactif">Inactif</option>
              </select>
            </div>
            <div>
              <label className="label">Début de contrat</label>
              <input type="date" className="input-field" value={form.contract_start} onChange={e => setForm(f => ({ ...f, contract_start: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fin de contrat</label>
              <input type="date" className="input-field" value={form.contract_end} min={form.contract_start || undefined} onChange={e => setForm(f => ({ ...f, contract_end: e.target.value }))} />
            </div>
            <div>
              <label className="label">WhatsApp <span className="text-text-secondary text-xs">(+33...)</span></label>
              <input className="input-field" value={form.whatsapp_number} onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))} placeholder="+33612345678" />
            </div>
            <div>
              <label className="label">Email pour notifications</label>
              <input className="input-field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+33612345678 (optionnel)" />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary flex items-center gap-2">
                {(createMutation.isPending || updateMutation.isPending) ? <LoadingSpinner size="sm" /> : <Check className="w-4 h-4" />}
                {editingId ? 'Enregistrer' : 'Ajouter'}
              </button>
              <button type="button" onClick={cancelForm} className="btn-secondary">Annuler</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>
      ) : franchisees.length === 0 ? (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-gold/10 border border-gold/20 mb-6">
            <Users className="w-8 h-8 text-gold" />
          </div>
          <p className="font-cormorant text-2xl text-text-primary mb-2">Aucun franchisé</p>
          <p className="font-dm-sans text-sm text-text-secondary mb-6 max-w-sm mx-auto">
            Ajoutez vos franchisés pour les notifier des mises à jour du DIP.
          </p>
          <button onClick={() => setShowForm(true)} className="btn-liquid-glass inline-flex">
            <Plus className="w-4 h-4" /> Ajouter un franchisé
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  {['Nom', 'Email', 'Territoire', 'Contrat', 'Statut', 'Notifier', ''].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 font-dm-mono text-xs text-text-secondary whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {franchisees.map((f, i) => {
                  const msg = notifyMsg || defaultMessage;
                  const wa = waLink(f.whatsapp_number, msg);
                  const mail = mailtoLink(f.email, `Mise à jour DIP${dip ? ' — ' + dip.title : ''}`, msg);
                  return (
                    <tr key={f.id} className={`border-b border-border-subtle hover:bg-bg-elevated transition-colors ${i === franchisees.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-4 py-3 font-dm-sans text-sm text-text-primary font-medium whitespace-nowrap">{f.name}</td>
                      <td className="px-4 py-3 font-dm-mono text-xs text-text-secondary">{f.email}</td>
                      <td className="px-4 py-3 font-dm-sans text-xs text-text-secondary">{f.territory || '—'}</td>
                      <td className="px-4 py-3 font-dm-mono text-xs text-text-secondary whitespace-nowrap">
                        {f.contract_start ? new Date(f.contract_start).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' }) : '—'}
                        {f.contract_end ? ' → ' + new Date(f.contract_end).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' }) : ''}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {wa && (
                            <a href={wa} target="_blank" rel="noreferrer"
                              title="Envoyer par WhatsApp"
                              className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-[#25D366] transition-colors">
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                          <a href={mail}
                            title="Envoyer par email"
                            className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-gold transition-colors">
                            <Mail className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(f)} title="Modifier" className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-gold transition-colors">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => { if (confirm(`Supprimer ${f.name} ?`)) deleteMutation.mutate(f.id); }} title="Supprimer" className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-danger transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal notification groupée */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl animate-slide-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-5 flex-shrink-0">
              <h3 className="font-cormorant text-xl">Notifier les franchisés</h3>
              <button onClick={() => setShowNotifyModal(false)} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1">
              {/* Message */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label">Message</label>
                  <button onClick={copyMessage} className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded border transition-all ${copied ? 'border-success/40 text-success bg-success/10' : 'border-border-subtle text-text-secondary hover:border-border-default'}`}>
                    <Copy className="w-3 h-3" />
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                </div>
                <textarea
                  className="input-field min-h-[140px] resize-y"
                  value={notifyMsg}
                  onChange={e => setNotifyMsg(e.target.value)}
                  rows={6}
                />
              </div>

              {/* Liens par franchisé */}
              <div>
                <p className="label mb-3">Envoyer individuellement ({actifs.length} franchisé(s) actif(s))</p>
                <div className="space-y-2">
                  {actifs.map(f => {
                    const wa = waLink(f.whatsapp_number, notifyMsg);
                    const mail = mailtoLink(f.email, `Mise à jour DIP${dip ? ' — ' + dip.title : ''}`, notifyMsg);
                    return (
                      <div key={f.id} className="flex items-center gap-3 bg-bg-elevated rounded px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-dm-sans text-sm font-medium text-text-primary">{f.name}</p>
                          <p className="font-dm-mono text-xs text-text-secondary truncate">{f.email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {wa ? (
                            <a href={wa} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/10 text-xs font-dm-sans transition-all">
                              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                            </a>
                          ) : (
                            <span className="text-xs text-text-muted font-dm-mono">pas de WA</span>
                          )}
                          <a href={mail}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold/30 text-gold hover:bg-gold/10 text-xs font-dm-sans transition-all">
                            <Mail className="w-3.5 h-3.5" /> Email
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gold/5 border border-gold/20 rounded p-3 flex items-start gap-3">
                <ExternalLink className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                <p className="font-dm-sans text-xs text-text-secondary leading-relaxed">
                  Les liens <strong className="text-text-primary">WhatsApp</strong> ouvrent l'app avec le message pré-rédigé.
                  Les liens <strong className="text-text-primary">Email</strong> ouvrent votre client mail avec le message pré-rempli.
                  Aucune clé API requise.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 flex-shrink-0 border-t border-border-subtle mt-4">
              <button onClick={() => setShowNotifyModal(false)} className="btn-secondary">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import CSV */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => { setShowCsvModal(false); setCsvPreview([]); setCsvError(''); }} />
          <div className="relative card w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-cormorant text-xl text-text-primary">Import CSV</h3>
                <p className="font-dm-sans text-xs text-text-secondary mt-0.5">
                  Colonnes requises : <code className="text-gold">name, email</code> — Optionnelles : <code className="text-gold">phone, whatsapp, territory</code>
                </p>
              </div>
              <button onClick={() => { setShowCsvModal(false); setCsvPreview([]); setCsvError(''); }}>
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="border-2 border-dashed border-border-default rounded-lg p-8 text-center mb-5">
              <FileText className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="font-dm-sans text-sm text-text-secondary mb-3">Glissez votre fichier CSV ou cliquez pour parcourir</p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFile}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="btn-secondary text-sm cursor-pointer">
                Choisir un fichier CSV
              </label>
            </div>

            {csvError && (
              <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 mb-4">
                <p className="font-dm-sans text-sm text-danger">{csvError}</p>
              </div>
            )}

            {csvPreview.length > 0 && (
              <>
                <div className="mb-4">
                  <p className="font-dm-sans text-sm text-text-primary mb-2">{csvPreview.length} franchisé(s) à importer :</p>
                  <div className="bg-bg-elevated rounded-lg overflow-hidden border border-border-subtle max-h-48 overflow-y-auto">
                    {csvPreview.slice(0, 20).map((row, i) => (
                      <div key={i} className="flex items-center gap-4 px-4 py-2 border-b border-border-subtle last:border-0 text-xs font-dm-sans">
                        <span className="text-text-primary font-medium w-40 truncate">{row.name || row.nom}</span>
                        <span className="text-text-secondary flex-1 truncate">{row.email}</span>
                        <span className="text-text-muted truncate">{row.territory || row.territoire || '—'}</span>
                      </div>
                    ))}
                    {csvPreview.length > 20 && (
                      <p className="text-center py-2 text-xs text-text-muted">... et {csvPreview.length - 20} autres</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => csvImportMutation.mutate(csvPreview)}
                  disabled={csvImportMutation.isPending}
                  className="btn-liquid-glass-prominent w-full flex items-center gap-2"
                >
                  {csvImportMutation.isPending ? <LoadingSpinner size="sm" /> : <Check className="w-4 h-4" />}
                  Importer {csvPreview.length} franchisé(s)
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
