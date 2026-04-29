import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusBadge from '../components/ui/StatusBadge';
import {
  Users, FileText, AlertTriangle, TrendingUp, Shield,
  Edit3, Trash2, Plus, Key, X, Check, Eye, ChevronDown, ChevronUp, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState(null);
  const [newPwd, setNewPwd] = useState('');
  const [createForm, setCreateForm] = useState({ email: '', password: '', company_name: '', role: 'franchiseur' });
  const [editUser, setEditUser] = useState(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data)
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(r => r.data),
    enabled: activeTab === 'users'
  });

  const { data: dipsData } = useQuery({
    queryKey: ['admin-dips'],
    queryFn: () => api.get('/admin/dips').then(r => r.data),
    enabled: activeTab === 'dips'
  });

  const { data: activityData } = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => api.get('/admin/activity').then(r => r.data),
    enabled: activeTab === 'activity'
  });

  const { data: userDetail } = useQuery({
    queryKey: ['admin-user', selectedUser],
    queryFn: () => api.get('/admin/users/' + selectedUser).then(r => r.data),
    enabled: !!selectedUser
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/admin/users', d),
    onSuccess: () => {
      toast.success('Compte créé avec succès');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setShowCreateUser(false);
      setCreateForm({ email: '', password: '', company_name: '', role: 'franchiseur' });
    },
    onError: (err) => toast.error(err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }) => api.put('/admin/users/' + id, d),
    onSuccess: () => {
      toast.success('Utilisateur mis à jour');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditUser(null);
    },
    onError: (err) => toast.error(err.message)
  });

  const resetPwdMutation = useMutation({
    mutationFn: ({ id, password }) => api.post('/admin/users/' + id + '/reset-password', { password }),
    onSuccess: () => {
      toast.success('Mot de passe réinitialisé');
      setShowResetPwd(null);
      setNewPwd('');
    },
    onError: (err) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete('/admin/users/' + id),
    onSuccess: () => {
      toast.success('Compte supprimé');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setSelectedUser(null);
    },
    onError: (err) => toast.error(err.message)
  });

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { key: 'users', label: 'Franchiseurs', icon: Users },
    { key: 'dips', label: 'Tous les DIPs', icon: FileText },
    { key: 'activity', label: 'Activité', icon: Activity }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Console Administrateur"
        subtitle="Gestion globale de la plateforme DIPpro"
        action={
          <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 rounded px-3 py-1.5">
            <Shield className="w-3.5 h-3.5 text-danger" />
            <span className="font-dm-mono text-xs text-danger">Accès Admin</span>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-elevated rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-dm-sans transition-all ${
              activeTab === t.key ? 'bg-gold text-bg-primary font-medium' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {statsLoading ? <LoadingSpinner size="lg" /> : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Franchiseurs', value: stats?.totalUsers || 0, icon: Users, color: 'text-gold' },
                  { label: 'DIPs analysés', value: stats?.totalDips || 0, icon: FileText, color: 'text-text-primary' },
                  { label: 'Franchisés', value: stats?.totalFranchisees || 0, icon: Users, color: 'text-success' },
                  { label: 'Alertes en attente', value: stats?.pendingAlerts || 0, icon: AlertTriangle, color: 'text-danger' },
                  { label: 'Score moyen', value: `${stats?.avgScore || 0}%`, icon: TrendingUp, color: 'text-gold' }
                ].map((s, i) => (
                  <div key={i} className="card">
                    <s.icon className={`w-5 h-5 ${s.color} mb-3`} />
                    <p className={`font-cormorant text-3xl ${s.color}`}>{s.value}</p>
                    <p className="font-dm-sans text-xs text-text-secondary mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="card">
                <h2 className="font-cormorant text-xl text-text-primary mb-4">Activité récente</h2>
                <div className="space-y-2">
                  {stats?.recentActivity?.slice(0, 8).map((a, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
                      <span className="font-dm-mono text-xs text-gold/60 w-32 flex-shrink-0">{a.action}</span>
                      <span className="font-dm-sans text-xs text-text-secondary flex-1">{a.user_id?.substring(0, 8)}...</span>
                      <span className="font-dm-mono text-xs text-text-muted">
                        {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowCreateUser(true)} className="btn-liquid-glass">
              <Plus className="w-4 h-4" /> Créer un compte
            </button>
          </div>

          {/* Create modal */}
          {showCreateUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70" onClick={() => setShowCreateUser(false)} />
              <div className="relative card w-full max-w-md">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-cormorant text-xl text-text-primary">Créer un compte</h3>
                  <button onClick={() => setShowCreateUser(false)}><X className="w-5 h-5 text-text-secondary" /></button>
                </div>
                <div className="space-y-4">
                  <div><label className="label">Email</label>
                    <input className="input-field" type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="email@franchise.fr" /></div>
                  <div><label className="label">Mot de passe</label>
                    <input className="input-field" type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 8 caractères" /></div>
                  <div><label className="label">Société</label>
                    <input className="input-field" value={createForm.company_name} onChange={e => setCreateForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Ma Franchise SAS" /></div>
                  <div><label className="label">Rôle</label>
                    <select className="input-field" value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="franchiseur">Franchiseur</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button onClick={() => createMutation.mutate(createForm)} disabled={createMutation.isPending} className="btn-liquid-glass-prominent w-full">
                    {createMutation.isPending ? <LoadingSpinner size="sm" /> : <Check className="w-4 h-4" />}
                    Créer le compte
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reset password modal */}
          {showResetPwd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70" onClick={() => setShowResetPwd(null)} />
              <div className="relative card w-full max-w-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-cormorant text-xl text-text-primary">Réinitialiser le mot de passe</h3>
                  <button onClick={() => setShowResetPwd(null)}><X className="w-5 h-5 text-text-secondary" /></button>
                </div>
                <input className="input-field mb-4" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Nouveau mot de passe (min. 8 car.)" />
                <button
                  onClick={() => resetPwdMutation.mutate({ id: showResetPwd, password: newPwd })}
                  disabled={newPwd.length < 8 || resetPwdMutation.isPending}
                  className="btn-liquid-glass-prominent w-full"
                >
                  {resetPwdMutation.isPending ? <LoadingSpinner size="sm" /> : <Key className="w-4 h-4" />}
                  Réinitialiser
                </button>
              </div>
            </div>
          )}

          {/* Users list */}
          {usersLoading ? <LoadingSpinner size="lg" /> : (
            <div className="space-y-2">
              {(usersData?.users || []).map(u => (
                <div key={u.id} className={`card transition-all ${selectedUser === u.id ? 'border-gold/40' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                      <span className="font-cormorant text-lg text-gold">{(u.company_name || u.email)[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-dm-sans text-sm font-medium text-text-primary">{u.company_name || '—'}</p>
                      <p className="font-dm-mono text-xs text-text-secondary">{u.email}</p>
                    </div>
                    <span className={`font-dm-mono text-xs px-2 py-0.5 rounded border ${
                      u.role === 'admin' ? 'text-danger border-danger/30 bg-danger/10' : 'text-gold border-gold/20 bg-gold/5'
                    }`}>{u.role}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setSelectedUser(selectedUser === u.id ? null : u.id)} title="Voir détails"
                        className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-gold transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditUser(u)} title="Modifier"
                        className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-gold transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setShowResetPwd(u.id)} title="Réinitialiser mot de passe"
                        className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-gold transition-colors">
                        <Key className="w-4 h-4" />
                      </button>
                      <button onClick={() => { if (confirm(`Supprimer ${u.email} ?`)) deleteMutation.mutate(u.id); }} title="Supprimer"
                        className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-danger transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Edit inline */}
                  {editUser?.id === u.id && (
                    <div className="mt-4 pt-4 border-t border-border-subtle grid grid-cols-2 gap-3">
                      <div><label className="label">Société</label>
                        <input className="input-field" value={editUser.company_name || ''} onChange={e => setEditUser(f => ({ ...f, company_name: e.target.value }))} /></div>
                      <div><label className="label">Rôle</label>
                        <select className="input-field" value={editUser.role} onChange={e => setEditUser(f => ({ ...f, role: e.target.value }))}>
                          <option value="franchiseur">Franchiseur</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="col-span-2 flex gap-2">
                        <button onClick={() => updateMutation.mutate(editUser)} className="btn-liquid-glass flex-1">
                          <Check className="w-4 h-4" /> Enregistrer
                        </button>
                        <button onClick={() => setEditUser(null)} className="btn-secondary">Annuler</button>
                      </div>
                    </div>
                  )}

                  {/* Detail panel */}
                  {selectedUser === u.id && userDetail && (
                    <div className="mt-4 pt-4 border-t border-border-subtle grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-dm-mono text-xs text-gold mb-2">DIPs ({userDetail.dips?.length || 0})</p>
                        {userDetail.dips?.map(d => (
                          <p key={d.id} className="font-dm-sans text-xs text-text-secondary py-1 border-b border-border-subtle">
                            {d.title} — <span className="text-gold">{d.conformity_score}%</span>
                          </p>
                        ))}
                      </div>
                      <div>
                        <p className="font-dm-mono text-xs text-gold mb-2">Franchisés ({userDetail.franchisees?.length || 0})</p>
                        {userDetail.franchisees?.map(f => (
                          <p key={f.id} className="font-dm-sans text-xs text-text-secondary py-1 border-b border-border-subtle">{f.name} — {f.email}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DIPS */}
      {activeTab === 'dips' && (
        <div className="space-y-2">
          {(dipsData?.dips || []).map(d => (
            <div key={d.id} className="card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-dm-sans text-sm font-medium text-text-primary truncate">{d.title}</p>
                <p className="font-dm-mono text-xs text-text-secondary">{d.users?.company_name || d.users?.email || '—'}</p>
              </div>
              <StatusBadge status={d.status} />
              <span className="font-cormorant text-xl text-gold">{d.conformity_score}%</span>
              <span className="font-dm-mono text-xs text-text-muted">
                {formatDistanceToNow(new Date(d.created_at), { addSuffix: true, locale: fr })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="card">
          <h2 className="font-cormorant text-xl text-text-primary mb-4">Journal d'activité global</h2>
          <div className="space-y-2">
            {(activityData?.activity || []).map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0">
                <span className="font-dm-mono text-xs text-gold/70 w-36 flex-shrink-0">{a.action}</span>
                <span className="font-dm-sans text-xs text-text-secondary flex-1">{a.users?.company_name || a.users?.email || a.user_id?.substring(0, 8)}</span>
                <span className="font-dm-mono text-xs text-text-muted flex-shrink-0">
                  {new Date(a.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
