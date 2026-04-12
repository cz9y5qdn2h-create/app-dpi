import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Save, Plus, Trash2, Database, Mail, Cloud, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

const SOURCE_TYPES = [
  { value: 'email', label: 'Email (Gmail)', icon: Mail },
  { value: 'google_drive', label: 'Google Drive', icon: Cloud },
  { value: 'manual', label: 'Upload manuel', icon: Database },
  { value: 'api', label: 'API externe', icon: Globe },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [profileForm, setProfileForm] = useState({ company_name: '', phone: '', address: '' });
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourceForm, setSourceForm] = useState({ type: 'manual', config: '{}' });

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data)
  });

  useEffect(() => {
    if (data?.profile) {
      setProfileForm({
        company_name: data.profile.company_name || '',
        phone: data.profile.phone || '',
        address: data.profile.address || ''
      });
    }
  }, [data]);

  const updateProfileMutation = useMutation({
    mutationFn: (d) => api.put('/settings/profile', d),
    onSuccess: () => { toast.success('Profil mis a jour'); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (err) => toast.error(err.message)
  });

  const addSourceMutation = useMutation({
    mutationFn: (d) => api.post('/settings/sources', d),
    onSuccess: () => { toast.success('Source ajoutee'); queryClient.invalidateQueries({ queryKey: ['settings'] }); setShowSourceForm(false); },
    onError: (err) => toast.error(err.message)
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (id) => api.delete('/settings/sources/' + id),
    onSuccess: () => { toast.success('Source supprimee'); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (err) => toast.error(err.message)
  });

  const sources = data?.data_sources || [];

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      <PageHeader title="Parametres" subtitle="Gestion du profil et des sources de donnees" />

      {/* Profil */}
      <div className="card">
        <h2 className="font-cormorant text-xl mb-5">Informations du franchiseur</h2>
        {isLoading ? <LoadingSpinner /> : (
          <form onSubmit={e => { e.preventDefault(); updateProfileMutation.mutate(profileForm); }} className="space-y-4">
            <div>
              <label className="label">Societe / Enseigne</label>
              <input className="input-field" value={profileForm.company_name} onChange={e => setProfileForm(f => ({...f, company_name: e.target.value}))} />
            </div>
            <div>
              <label className="label">Telephone</label>
              <input className="input-field" value={profileForm.phone} onChange={e => setProfileForm(f => ({...f, phone: e.target.value}))} placeholder="+33 1 23 45 67 89" />
            </div>
            <div>
              <label className="label">Adresse du siege</label>
              <textarea className="input-field resize-none min-h-20" value={profileForm.address} onChange={e => setProfileForm(f => ({...f, address: e.target.value}))} placeholder="123 rue de la Paix, 75001 Paris" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input-field opacity-60" value={data?.profile?.email || ''} readOnly />
            </div>
            <button type="submit" disabled={updateProfileMutation.isPending} className="btn-primary flex items-center gap-2">
              {updateProfileMutation.isPending ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
          </form>
        )}
      </div>

      {/* Sources de donnees */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-cormorant text-xl">Sources de donnees</h2>
            <p className="font-dm-sans text-xs text-text-secondary mt-1">Connexions surveillees pour la detection de changements</p>
          </div>
          <button onClick={() => setShowSourceForm(!showSourceForm)} className="btn-secondary flex items-center gap-2 text-sm py-2">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </div>

        {showSourceForm && (
          <div className="bg-bg-elevated rounded-lg p-4 mb-5 border border-border-default animate-slide-up">
            <div className="space-y-3">
              <div>
                <label className="label">Type de source</label>
                <select className="input-field" value={sourceForm.type} onChange={e => setSourceForm(f => ({...f, type: e.target.value}))}>
                  {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => addSourceMutation.mutate({ type: sourceForm.type, config: {} })} className="btn-primary text-sm py-2 flex items-center gap-2">
                  {addSourceMutation.isPending ? <LoadingSpinner size="sm" /> : <Plus className="w-4 h-4" />} Ajouter
                </button>
                <button onClick={() => setShowSourceForm(false)} className="btn-ghost text-sm">Annuler</button>
              </div>
            </div>
          </div>
        )}

        {sources.length === 0 ? (
          <p className="font-dm-sans text-sm text-text-secondary text-center py-6">
            Aucune source configuree. Ajoutez des connexions pour la surveillance automatique.
          </p>
        ) : (
          <div className="space-y-3">
            {sources.map(source => {
              const typeInfo = SOURCE_TYPES.find(t => t.value === source.type);
              const Icon = typeInfo?.icon || Database;
              return (
                <div key={source.id} className="flex items-center justify-between p-3 bg-bg-elevated rounded border border-border-subtle">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gold/10 border border-gold/20 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-gold" />
                    </div>
                    <div>
                      <p className="font-dm-sans text-sm text-text-primary">{typeInfo?.label || source.type}</p>
                      {source.last_synced && (
                        <p className="font-dm-mono text-xs text-text-secondary">
                          Derniere synchro: {new Date(source.last_synced).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { if (confirm('Supprimer cette source ?')) deleteSourceMutation.mutate(source.id); }} className="text-text-secondary hover:text-danger transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}