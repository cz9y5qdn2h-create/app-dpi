import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  UserCheck, UserX, Trash2, UserPlus, Shield, Eye, EyeOff,
  AlertCircle, CheckCircle, Users, RefreshCw, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ADMIN_EMAIL = 'theo@iralink-agency.com';

function CreateUserModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ email: '', password: '', company_name: '', role: 'franchiseur' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };
  const strength = passwordStrength(form.password);
  const strengthColors = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-gold', 'bg-success'];
  const strengthLabels = ['', 'Faible', 'Moyen', 'Bon', 'Excellent'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (strength < 2) return setError('Mot de passe trop faible (utilisez majuscules, chiffres, symboles)');
    setLoading(true);
    try {
      await api.post('/admin/users', form);
      toast.success(`Compte créé pour ${form.email}`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-default rounded-lg w-full max-w-md shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <UserPlus className="w-5 h-5 text-gold" />
            <h3 className="font-cormorant text-xl text-text-primary">Créer un compte client</h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-3 bg-danger/10 border border-danger/20 text-danger rounded p-3 text-sm font-dm-sans">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="label">Nom de la société / Enseigne *</label>
            <input
              type="text"
              className="input-field"
              placeholder="Ma Franchise SAS"
              value={form.company_name}
              onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              className="input-field"
              placeholder="client@entreprise.fr"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label">Mot de passe *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field pr-12"
                placeholder="Minimum 8 caractères"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.password && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColors[strength] : 'bg-bg-elevated'}`}
                    />
                  ))}
                </div>
                <p className="text-xs font-dm-mono text-text-secondary mt-1">{strengthLabels[strength]}</p>
              </div>
            )}
          </div>

          <div>
            <label className="label">Rôle</label>
            <select
              className="input-field"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            >
              <option value="franchiseur">Franchiseur</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? <LoadingSpinner size="sm" /> : <UserPlus className="w-4 h-4" />}
              {loading ? 'Création...' : 'Créer le compte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get('/admin/users').then(r => r.data),
    retry: false
  });

  const users = data?.users || [];
  const activeCount = users.filter(u => u.is_active && u.email !== ADMIN_EMAIL).length;
  const totalClients = users.filter(u => u.email !== ADMIN_EMAIL).length;

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/admin/users/${id}`, { is_active }),
    onSuccess: (_, { is_active }) => {
      toast.success(is_active ? 'Compte activé' : 'Compte suspendu');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      toast.success('Compte supprimé');
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => {
      toast.error(err.message);
      setConfirmDelete(null);
    }
  });

  const roleBadge = (role) => {
    if (role === 'admin') return <span className="font-dm-mono text-xs px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">Admin</span>;
    return <span className="font-dm-mono text-xs px-2 py-0.5 rounded bg-bg-elevated text-text-secondary border border-border-subtle">Franchiseur</span>;
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded bg-gold/10 border border-gold/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-gold" />
            </div>
            <h1 className="font-cormorant text-3xl text-text-primary font-light">Administration</h1>
          </div>
          <p className="font-dm-sans text-sm text-text-secondary">
            Gestion des accès clients — seul cet espace peut créer des comptes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Créer un compte
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card border-border-default text-center">
          <p className="font-dm-mono text-2xl text-text-primary">{totalClients}</p>
          <p className="font-dm-sans text-xs text-text-secondary mt-1">Clients total</p>
        </div>
        <div className="card border-border-default text-center">
          <p className="font-dm-mono text-2xl text-success">{activeCount}</p>
          <p className="font-dm-sans text-xs text-text-secondary mt-1">Comptes actifs</p>
        </div>
        <div className="card border-border-default text-center">
          <p className="font-dm-mono text-2xl text-danger">{totalClients - activeCount}</p>
          <p className="font-dm-sans text-xs text-text-secondary mt-1">Comptes suspendus</p>
        </div>
      </div>

      {/* Table utilisateurs */}
      <div className="card border-border-default overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-border-subtle flex items-center gap-3">
          <Users className="w-4 h-4 text-text-secondary" />
          <h2 className="font-cormorant text-xl text-text-primary">Comptes utilisateurs</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 text-danger p-6 text-sm font-dm-sans">
            <AlertCircle className="w-4 h-4" />
            Erreur: {error.message}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-text-secondary font-dm-sans text-sm">
            Aucun utilisateur trouvé.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-elevated/50">
                  <th className="text-left px-6 py-3 font-dm-mono text-xs text-text-secondary uppercase tracking-wider">Société</th>
                  <th className="text-left px-6 py-3 font-dm-mono text-xs text-text-secondary uppercase tracking-wider">Email</th>
                  <th className="text-left px-6 py-3 font-dm-mono text-xs text-text-secondary uppercase tracking-wider">Rôle</th>
                  <th className="text-left px-6 py-3 font-dm-mono text-xs text-text-secondary uppercase tracking-wider">Statut</th>
                  <th className="text-left px-6 py-3 font-dm-mono text-xs text-text-secondary uppercase tracking-wider">Créé le</th>
                  <th className="text-right px-6 py-3 font-dm-mono text-xs text-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {users.map(user => {
                  const isMainAdmin = user.email === ADMIN_EMAIL;
                  return (
                    <tr key={user.id} className="hover:bg-bg-elevated/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-dm-sans text-sm text-text-primary font-medium">
                          {user.company_name || '—'}
                        </p>
                        {isMainAdmin && (
                          <p className="font-dm-mono text-xs text-gold mt-0.5">Compte principal</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-dm-mono text-xs text-text-secondary">{user.email}</p>
                      </td>
                      <td className="px-6 py-4">{roleBadge(user.role)}</td>
                      <td className="px-6 py-4">
                        {user.is_active !== false ? (
                          <span className="flex items-center gap-1.5 text-success text-xs font-dm-mono">
                            <CheckCircle className="w-3.5 h-3.5" /> Actif
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-danger text-xs font-dm-mono">
                            <UserX className="w-3.5 h-3.5" /> Suspendu
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-dm-mono text-xs text-text-secondary">
                          {user.created_at
                            ? format(new Date(user.created_at), 'dd MMM yyyy', { locale: fr })
                            : '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {!isMainAdmin && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => toggleMutation.mutate({ id: user.id, is_active: !(user.is_active !== false) })}
                              disabled={toggleMutation.isPending}
                              title={user.is_active !== false ? 'Suspendre le compte' : 'Réactiver le compte'}
                              className={`p-2 rounded transition-colors ${
                                user.is_active !== false
                                  ? 'text-warning hover:bg-warning/10'
                                  : 'text-success hover:bg-success/10'
                              }`}
                            >
                              {user.is_active !== false
                                ? <UserX className="w-4 h-4" />
                                : <UserCheck className="w-4 h-4" />
                              }
                            </button>
                            <button
                              onClick={() => setConfirmDelete(user)}
                              disabled={deleteMutation.isPending}
                              title="Supprimer le compte"
                              className="p-2 rounded text-danger hover:bg-danger/10 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notice légale */}
      <div className="card border-border-subtle bg-bg-elevated/30 p-4">
        <p className="font-dm-sans text-xs text-text-muted leading-relaxed">
          <span className="text-text-secondary font-medium">RGPD — Art. 13 &amp; 28 :</span>{' '}
          Les données personnelles des utilisateurs (email, nom de société) sont traitées
          sur la base de l&apos;exécution du contrat (Art. 6.1.b RGPD). Durée de conservation&nbsp;: durée
          du contrat + 3 ans. Droit d&apos;accès, rectification et suppression sur demande
          à <a href="mailto:theo@iralink-agency.com" className="text-gold hover:underline">theo@iralink-agency.com</a>.
          Toute suppression de compte entraîne la suppression définitive des données associées.
        </p>
      </div>

      {/* Modal création */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })}
        />
      )}

      {/* Modal confirmation suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-danger/30 rounded-lg w-full max-w-sm p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="w-5 h-5 text-danger" />
              <h3 className="font-cormorant text-xl text-text-primary">Supprimer le compte</h3>
            </div>
            <p className="font-dm-sans text-sm text-text-secondary mb-2">
              Supprimer définitivement le compte de{' '}
              <span className="text-text-primary font-medium">{confirmDelete.company_name || confirmDelete.email}</span> ?
            </p>
            <p className="font-dm-sans text-xs text-danger/80 mb-6">
              Cette action est irréversible. Toutes les données DIP, alertes et historiques associés seront perdus.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Annuler</button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-danger/90 hover:bg-danger text-white text-sm font-dm-sans rounded px-4 py-2.5 transition-colors"
              >
                {deleteMutation.isPending ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
