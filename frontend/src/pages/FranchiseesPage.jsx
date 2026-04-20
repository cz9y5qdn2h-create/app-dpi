import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Plus, Users, Edit3, Trash2, Send, X, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  name: '', email: '', territory: '',
  contract_start: '', contract_end: '', status: 'actif'
};

export default function FranchiseesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [formError, setFormError] = useState('');

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
      toast.success('Franchisé ajouté avec succès');
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

  const franchisees = data?.franchisees || [];

  const handleNotify = async () => {
    const dip = dipsData?.dips?.[0];
    if (!dip) return toast.error('Aucun DIP disponible pour notifier');
    if (franchisees.length === 0) return toast.error('Aucun franchisé à notifier');
    const actifs = franchisees.filter(f => f.status === 'actif');
    if (actifs.length === 0) return toast.error('Aucun franchisé actif');
    setNotifyLoading(true);
    try {
      const res = await api.post('/franchisees/notify', {
        dip_id: dip.id,
        updated_sections: dip.dip_sections?.map(s => ({
          title: s.section_title,
          status: s.status
        }))
      });
      toast.success(`${res.data.sent ?? actifs.length} franchisé(s) notifié(s)`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setNotifyLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    // Validate dates
    if (form.contract_start && form.contract_end && form.contract_start > form.contract_end) {
      return setFormError('La date de fin doit être après la date de début');
    }
    if (editingId) updateMutation.mutate({ id: editingId, ...form });
    else createMutation.mutate(form);
  };

  const openEdit = (f) => {
    setEditingId(f.id);
    setForm({
      name: f.name,
      email: f.email,
      territory: f.territory || '',
      contract_start: f.contract_start ? f.contract_start.split('T')[0] : '',
      contract_end: f.contract_end ? f.contract_end.split('T')[0] : '',
      status: f.status || 'actif'
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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Franchisés"
        subtitle={`${franchisees.length} franchisé(s) dans le réseau`}
        action={
          <div className="flex gap-3">
            {franchisees.length > 0 && (
              <button
                onClick={handleNotify}
                disabled={notifyLoading}
                className="btn-secondary flex items-center gap-2"
              >
                {notifyLoading ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
                Notifier tous
              </button>
            )}
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); setFormError(''); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>
        }
      />

      {/* Form : Create or Edit */}
      {(showForm || editingId) && (
        <div className="card border-border-default animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-cormorant text-xl">
              {editingId ? 'Modifier le franchisé' : 'Ajouter un franchisé'}
            </h3>
            <button onClick={cancelForm} className="text-text-secondary hover:text-text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 text-danger rounded p-3 mb-4 text-sm font-dm-sans">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nom complet *</label>
              <input
                className="input-field"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Jean Dupont"
                required
              />
            </div>
            <div>
              <label className="label">Email *</label>
              <input
                type="email"
                className="input-field"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jean@franchise.fr"
                required
              />
            </div>
            <div>
              <label className="label">Territoire</label>
              <input
                className="input-field"
                value={form.territory}
                onChange={e => setForm(f => ({ ...f, territory: e.target.value }))}
                placeholder="Paris 15e"
              />
            </div>
            <div>
              <label className="label">Statut</label>
              <select
                className="input-field"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="actif">Actif</option>
                <option value="en_cours">En cours de démarrage</option>
                <option value="inactif">Inactif</option>
              </select>
            </div>
            <div>
              <label className="label">Début de contrat</label>
              <input
                type="date"
                className="input-field"
                value={form.contract_start}
                onChange={e => setForm(f => ({ ...f, contract_start: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Fin de contrat</label>
              <input
                type="date"
                className="input-field"
                value={form.contract_end}
                min={form.contract_start || undefined}
                onChange={e => setForm(f => ({ ...f, contract_end: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                {(createMutation.isPending || updateMutation.isPending)
                  ? <LoadingSpinner size="sm" />
                  : <Check className="w-4 h-4" />}
                {editingId ? 'Enregistrer' : 'Ajouter'}
              </button>
              <button type="button" onClick={cancelForm} className="btn-secondary">
                Annuler
              </button>
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
            Ajoutez vos franchisés pour les notifier automatiquement des mises à jour du DIP.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-liquid-glass inline-flex"
          >
            <Plus className="w-4 h-4" /> Ajouter un franchisé
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  {['Nom', 'Email', 'Territoire', 'Contrat', 'Statut', ''].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 font-dm-mono text-xs text-text-secondary whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {franchisees.map((f, i) => (
                  <tr
                    key={f.id}
                    className={`border-b border-border-subtle hover:bg-bg-elevated transition-colors ${
                      i === franchisees.length - 1 ? 'border-0' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-dm-sans text-sm text-text-primary font-medium whitespace-nowrap">
                      {f.name}
                    </td>
                    <td className="px-4 py-3 font-dm-mono text-xs text-text-secondary">{f.email}</td>
                    <td className="px-4 py-3 font-dm-sans text-xs text-text-secondary">{f.territory || '—'}</td>
                    <td className="px-4 py-3 font-dm-mono text-xs text-text-secondary whitespace-nowrap">
                      {f.contract_start
                        ? new Date(f.contract_start).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' })
                        : '—'}
                      {f.contract_end
                        ? ' → ' + new Date(f.contract_end).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' })
                        : ''}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(f)}
                          className="text-text-secondary hover:text-gold transition-colors"
                          title="Modifier"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Supprimer ${f.name} ?`)) deleteMutation.mutate(f.id);
                          }}
                          className="text-text-secondary hover:text-danger transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
