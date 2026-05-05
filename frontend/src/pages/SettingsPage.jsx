import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Save, Plus, Trash2, Database, Mail, Cloud, Globe, CheckCircle, Eye, EyeOff, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const SOURCE_TYPES = [
  { value: 'email', label: 'Email (Gmail)', icon: Mail },
  { value: 'google_drive', label: 'Google Drive', icon: Cloud },
  { value: 'manual', label: 'Upload manuel', icon: Database },
  { value: 'api', label: 'API externe', icon: Globe },
];

const AUTOMATION_LEVELS = [
  {
    level: 1,
    title: 'Contrôle total',
    description: 'Chaque changement détecté doit être approuvé ou rejeté individuellement. Recommandé pour les franchiseurs qui souhaitent valider chaque modification avant publication.',
    badge: 'Manuel'
  },
  {
    level: 2,
    title: 'Semi-automatique',
    description: 'Tous les changements proposés par l\'IA sont affichés ensemble. Une seule action "Approuver tout" suffit pour valider l\'ensemble des modifications en une fois.',
    badge: 'Hybride'
  },
  {
    level: 3,
    title: 'Full automatique',
    description: 'Les changements sont appliqués automatiquement après un délai de 48h. Vous recevez une notification et pouvez les consulter, mais aucune action n\'est requise.',
    badge: 'Auto'
  }
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [profileForm, setProfileForm] = useState({
    company_name: '', phone: '', address: '',
    automation_level: 1,
    notifications_email: true, notifications_inapp: true,
    notifications_sms: false, notification_frequency: 'immediate'
  });
  const [brevoForm, setBrevoForm] = useState({ brevo_api_key: '', brevo_sender_name: 'DIPpro', brevo_sender_email: '' });
  const [showBrevoKey, setShowBrevoKey] = useState(false);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourceForm, setSourceForm] = useState({ type: 'manual' });

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data)
  });

  useEffect(() => {
    if (data?.profile) {
      setProfileForm({
        company_name: data.profile.company_name || '',
        phone: data.profile.phone || '',
        address: data.profile.address || '',
        automation_level: data.profile.automation_level || 1,
        notifications_email: data.profile.notifications_email ?? true,
        notifications_inapp: data.profile.notifications_inapp ?? true,
        notifications_sms: data.profile.notifications_sms ?? false,
        notification_frequency: data.profile.notification_frequency || 'immediate'
      });
      setBrevoForm({
        brevo_api_key: data.profile.brevo_api_key || '',
        brevo_sender_name: data.profile.brevo_sender_name || 'DIPpro',
        brevo_sender_email: data.profile.brevo_sender_email || ''
      });
    }
  }, [data]);

  const updateProfileMutation = useMutation({
    mutationFn: (d) => api.put('/settings/profile', d),
    onSuccess: () => {
      toast.success('Paramètres enregistrés');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => toast.error(err.message)
  });

  const saveBrevoMutation = useMutation({
    mutationFn: (d) => api.put('/settings/profile', d),
    onSuccess: () => { toast.success('Configuration email enregistrée'); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (err) => toast.error(err.message)
  });

  const testEmailMutation = useMutation({
    mutationFn: () => api.post('/notifications/test', { channel: 'email', target: data?.profile?.email }),
    onSuccess: (res) => {
      if (res.data.ok) toast.success('Email de test envoyé !');
      else toast.error('Échec : ' + (res.data.error || 'Vérifiez votre clé Brevo'));
    },
    onError: (err) => toast.error(err.message)
  });

  const addSourceMutation = useMutation({
    mutationFn: (d) => api.post('/settings/sources', d),
    onSuccess: () => {
      toast.success('Source ajoutée');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setShowSourceForm(false);
    },
    onError: (err) => toast.error(err.message)
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (id) => api.delete('/settings/sources/' + id),
    onSuccess: () => {
      toast.success('Source supprimée');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => toast.error(err.message)
  });

  const sources = data?.data_sources || [];

  const handleSave = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      <PageHeader title="Paramètres" subtitle="Profil, automatisation et préférences de notification" />

      {/* Profil */}
      <div className="card">
        <h2 className="font-cormorant text-xl mb-5">Informations du franchiseur</h2>
        {isLoading ? <LoadingSpinner /> : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label">Société / Enseigne</label>
              <input className="input-field" value={profileForm.company_name}
                onChange={e => setProfileForm(f => ({ ...f, company_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input-field" value={profileForm.phone}
                onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+33 1 23 45 67 89" />
            </div>
            <div>
              <label className="label">Adresse du siège</label>
              <textarea className="input-field resize-none min-h-20" value={profileForm.address}
                onChange={e => setProfileForm(f => ({ ...f, address: e.target.value }))}
                placeholder="123 rue de la Paix, 75001 Paris" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input-field opacity-60" value={data?.profile?.email || ''} readOnly />
            </div>
            <button type="submit" disabled={updateProfileMutation.isPending}
              className="btn-primary flex items-center gap-2">
              {updateProfileMutation.isPending ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
              Enregistrer le profil
            </button>
          </form>
        )}
      </div>

      {/* Niveau d'automatisation */}
      <div className="card">
        <div className="mb-5">
          <h2 className="font-cormorant text-xl">Niveau d'automatisation</h2>
          <p className="font-dm-sans text-xs text-text-secondary mt-1">
            Définit comment DIPpro gère les changements détectés dans votre DIP
          </p>
        </div>

        {isLoading ? <LoadingSpinner /> : (
          <div className="space-y-3">
            {AUTOMATION_LEVELS.map(({ level, title, description, badge }) => {
              const isSelected = profileForm.automation_level === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setProfileForm(f => ({ ...f, automation_level: level }))}
                  className={`w-full text-left rounded-lg p-4 border transition-all duration-200 ${
                    isSelected
                      ? 'border-gold/50 bg-gold/5'
                      : 'border-border-subtle bg-bg-elevated hover:border-border-default'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                      isSelected ? 'border-gold bg-gold' : 'border-border-default'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-bg-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-dm-sans text-sm font-medium text-text-primary">
                          Niveau {level} — {title}
                        </span>
                        <span className={`font-dm-mono text-xs px-2 py-0.5 rounded border ${
                          level === 1 ? 'bg-danger/10 text-danger border-danger/20' :
                          level === 2 ? 'bg-gold/10 text-gold border-gold/20' :
                          'bg-success/10 text-success border-success/20'
                        }`}>
                          {badge}
                        </span>
                      </div>
                      <p className="font-dm-sans text-xs text-text-secondary leading-relaxed">
                        {description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => updateProfileMutation.mutate({ automation_level: profileForm.automation_level })}
              disabled={updateProfileMutation.isPending}
              className="btn-liquid-glass w-full mt-2"
            >
              {updateProfileMutation.isPending ? <LoadingSpinner size="sm" /> : <CheckCircle className="w-4 h-4" />}
              Enregistrer le niveau d'automatisation
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="card">
        <div className="mb-5">
          <h2 className="font-cormorant text-xl">Notifications</h2>
          <p className="font-dm-sans text-xs text-text-secondary mt-1">
            Choisissez comment et quand être alerté des changements
          </p>
        </div>

        {isLoading ? <LoadingSpinner /> : (
          <div className="space-y-6">
            {/* Canaux */}
            <div>
              <p className="font-dm-sans text-sm text-text-primary mb-3">Canaux actifs</p>
              <div className="space-y-3">
                {[
                  { key: 'notifications_email', label: 'Email', desc: 'Reçu à votre adresse de connexion' },
                  { key: 'notifications_inapp', label: 'In-app', desc: 'Cloche et toasts dans l\'interface' },
                  { key: 'notifications_sms', label: 'SMS', desc: 'Alertes critiques uniquement (bientôt)' },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={profileForm[key]}
                        onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.checked }))}
                      />
                      <div className={`w-10 h-6 rounded-full transition-all duration-200 ${
                        profileForm[key] ? 'bg-gold' : 'bg-border-default'
                      }`} />
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-bg-primary transition-all duration-200 ${
                        profileForm[key] ? 'left-5' : 'left-1'
                      }`} />
                    </div>
                    <div>
                      <p className="font-dm-sans text-sm text-text-primary">{label}</p>
                      <p className="font-dm-sans text-xs text-text-secondary">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Fréquence */}
            <div>
              <p className="font-dm-sans text-sm text-text-primary mb-3">Fréquence d'envoi</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'immediate', label: 'Immédiat' },
                  { value: 'daily', label: 'Digest quotidien' },
                  { value: 'weekly', label: 'Digest hebdo' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setProfileForm(f => ({ ...f, notification_frequency: value }))}
                    className={`py-2 px-3 rounded text-xs font-dm-sans transition-all duration-200 border ${
                      profileForm.notification_frequency === value
                        ? 'border-gold/50 bg-gold/10 text-gold'
                        : 'border-border-subtle bg-bg-elevated text-text-secondary hover:border-border-default'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => updateProfileMutation.mutate({
                notifications_email: profileForm.notifications_email,
                notifications_inapp: profileForm.notifications_inapp,
                notifications_sms: profileForm.notifications_sms,
                notification_frequency: profileForm.notification_frequency
              })}
              disabled={updateProfileMutation.isPending}
              className="btn-liquid-glass w-full"
            >
              {updateProfileMutation.isPending ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
              Enregistrer les notifications
            </button>
          </div>
        )}
      </div>

      {/* Configuration email Brevo */}
      <div className="card">
        <div className="mb-5">
          <h2 className="font-cormorant text-xl">Envoi d'emails (Brevo)</h2>
          <p className="font-dm-sans text-xs text-text-secondary mt-1">
            Configurez votre compte Brevo pour envoyer des emails à vos franchisés. Obtenez une clé API gratuite sur{' '}
            <a href="https://www.brevo.com" target="_blank" rel="noreferrer" className="text-gold hover:underline">brevo.com</a>.
          </p>
        </div>

        {isLoading ? <LoadingSpinner /> : (
          <div className="space-y-4">
            <div>
              <label className="label">Clé API Brevo</label>
              <div className="relative">
                <input
                  className="input-field pr-10"
                  type={showBrevoKey ? 'text' : 'password'}
                  value={brevoForm.brevo_api_key}
                  onChange={e => setBrevoForm(f => ({ ...f, brevo_api_key: e.target.value }))}
                  placeholder="xkeysib-..."
                />
                <button
                  type="button"
                  onClick={() => setShowBrevoKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showBrevoKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Nom de l'expéditeur</label>
              <input
                className="input-field"
                value={brevoForm.brevo_sender_name}
                onChange={e => setBrevoForm(f => ({ ...f, brevo_sender_name: e.target.value }))}
                placeholder="DIPpro"
              />
            </div>
            <div>
              <label className="label">Email de l'expéditeur</label>
              <input
                className="input-field"
                type="email"
                value={brevoForm.brevo_sender_email}
                onChange={e => setBrevoForm(f => ({ ...f, brevo_sender_email: e.target.value }))}
                placeholder="contact@monenseigne.fr"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => saveBrevoMutation.mutate(brevoForm)}
                disabled={saveBrevoMutation.isPending}
                className="btn-liquid-glass flex items-center gap-2"
              >
                {saveBrevoMutation.isPending ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => testEmailMutation.mutate()}
                disabled={testEmailMutation.isPending || !brevoForm.brevo_api_key}
                className="btn-secondary flex items-center gap-2"
              >
                {testEmailMutation.isPending ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
                Tester
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sources de données */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-cormorant text-xl">Sources de données</h2>
            <p className="font-dm-sans text-xs text-text-secondary mt-1">
              Connexions surveillées pour la détection automatique de changements
            </p>
          </div>
          <button onClick={() => setShowSourceForm(!showSourceForm)}
            className="btn-secondary flex items-center gap-2 text-sm py-2">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </div>

        {showSourceForm && (
          <div className="bg-bg-elevated rounded-lg p-4 mb-5 border border-border-default animate-slide-up">
            <div className="space-y-3">
              <div>
                <label className="label">Type de source</label>
                <select className="input-field" value={sourceForm.type}
                  onChange={e => setSourceForm(f => ({ ...f, type: e.target.value }))}>
                  {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => addSourceMutation.mutate({ type: sourceForm.type, config: {} })}
                  className="btn-primary text-sm py-2 flex items-center gap-2">
                  {addSourceMutation.isPending ? <LoadingSpinner size="sm" /> : <Plus className="w-4 h-4" />}
                  Ajouter
                </button>
                <button onClick={() => setShowSourceForm(false)} className="btn-ghost text-sm">Annuler</button>
              </div>
            </div>
          </div>
        )}

        {sources.length === 0 ? (
          <p className="font-dm-sans text-sm text-text-secondary text-center py-6">
            Aucune source configurée. Ajoutez des connexions pour la surveillance automatique.
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
                          Dernière synchro: {new Date(source.last_synced).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { if (confirm('Supprimer cette source ?')) deleteSourceMutation.mutate(source.id); }}
                    className="text-text-secondary hover:text-danger transition-colors">
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
