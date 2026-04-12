import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Plus, Users, Edit3, Trash2, Send, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_FORM = { name: '', email: '', territory: '', contract_start: '', contract_end: '', status: 'actif' };

export default function FranchiseesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notifyLoading, setNotifyLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['franchisees'],
    queryFn: () => api.get('/franchisees').then(r => r.data)
  });

  const { data: dipsData } = useQuery({
    queryKey: ['dips'],
    queryFn: () => api.get('/dip').then(r => r.data)
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/franchisees', data),
    onSuccess: () => { toast.success('Franchise ajoute'); queryClient.invalidateQueries({ queryKey: ['franchisees'] }); setShowForm(false); setForm(EMPTY_FORM); },
    onError: (err) => toast.error(err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.put('/franchisees/' + id, data),
    onSuccess: () => { toast.success('Franchise mis a jour'); queryClient.invalidateQueries({ queryKey: ['franchisees'] }); setEditingId(null); },
    onError: (err) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete('/franchisees/' + id),
    onSuccess: () => { toast.success('Franchise supprime'); queryClient.invalidateQueries({ queryKey: ['franchisees'] }); },
    onError: (err) => toast.error(err.message)
  });

  const handleNotify = async () => {
    const dip = dipsData?.dips?.[0];
    if (!dip) return toast.error('Aucun DIP disponible');
    setNotifyLoading(true);
    try {
      const res = await api.post('/franchisees/notify', {
        dip_id: dip.id,
        updated_sections: dip.dip_sections?.map(s => ({ title: s.section_title, status: s.status }))
      });
      toast.success('Notifications envoyees: ' + res.data.sent + ' franchise(s)');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setNotifyLoading(false);
    }
  };

  const franchisees = data?.franchisees || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) updateMutation.mutate({ id: editingId, ...form });
    else createMutation.mutate(form);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Franchises"
        subtitle={franchisees.length + ' franchise(s) dans le reseau'}
        action={
          <div className="flex gap-3">
            <button onClick={handleNotify} disabled={notifyLoading} className="btn-secondary flex items-center gap-2">
              {notifyLoading ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
              Notifier tous
            </button>
            <button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>
        }
      />

      {(showForm || editingId) && (
        <div className="card border-border-default animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-cormorant text-xl">{editingId ? 'Modifier' : 'Ajouter un franchise'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-text-secondary hover:text-text-primary">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Nom</label><input className="input-field" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required /></div>
            <div><label className="label">Email</label><input type="email" className="input-field" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required /></div>
            <div><label className="label">Territoire</label><input className="input-field" value={form.territory} onChange={e => setForm(f => ({...f, territory: e.target.value}))} placeholder="Paris 15e" /></div>
            <div>
              <label className="label">Statut</label>
              <select className="input-field" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
                <option value="en_cours">En cours</option>
              </select>
            </div>
            <div><label className="label">Debut contrat</label><input type="date" className="input-field" value={form.contract_start} onChange={e => setForm(f => ({...f, contract_start: e.target.value}))} /></div>
            <div><label className="label">Fin contrat</label><input type="date" className="input-field" value={form.contract_end} onChange={e => setForm(f => ({...f, contract_end: e.target.value}))} /></div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary flex items-center gap-2">
                {(createMutation.isPending || updateMutation.isPending) ? <LoadingSpinner size="sm" /> : <Check className="w-4 h-4" />}
                {editingId ? 'Enregistrer' : 'Ajouter'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-secondary">Annuler</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>
      ) : franchisees.length === 0 ? (
        <div className="text-center py-24">
          <Users className="w-10 h-10 text-text-muted mx-auto mb-4" />
          <p className="font-cormorant text-2xl text-text-primary mb-2">Aucun franchise</p>
          <p className="font-dm-sans text-sm text-text-secondary mb-6">Ajoutez vos franchises pour les notifier des mises a jour du DIP.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Ajouter un franchise
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  {['Nom', 'Email', 'Territoire', 'Contrat', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-dm-mono text-xs text-text-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {franchisees.map((f, i) => (
                  <tr key={f.id} className={'border-b border-border-subtle hover:bg-bg-elevated transition-colors ' + (i === franchisees.length - 1 ? 'border-0' : '')}>
                    <td className="px-4 py-3 font-dm-sans text-sm text-text-primary">{f.name}</td>
                    <td className="px-4 py-3 font-dm-mono text-xs text-text-secondary">{f.email}</td>
                    <td className="px-4 py-3 font-dm-sans text-xs text-text-secondary">{f.territory || '-'}</td>
                    <td className="px-4 py-3 font-dm-mono text-xs text-text-secondary">
                      {f.contract_start ? new Date(f.contract_start).getFullYear() : '-'}
                      {f.contract_end ? ' - ' + new Date(f.contract_end).getFullYear() : ''}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditingId(f.id); setForm({ name: f.name, email: f.email, territory: f.territory || '', contract_start: f.contract_start || '', contract_end: f.contract_end || '', status: f.status || 'actif' }); setShowForm(false); }} className="text-text-secondary hover:text-gold transition-colors">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if (confirm('Supprimer ce franchise ?')) deleteMutation.mutate(f.id); }} className="text-text-secondary hover:text-danger transition-colors">
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