import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { CheckCircle, XCircle, Bell, Edit3, X, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('pending');
  const [validatingId, setValidatingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [ignoreId, setIgnoreId] = useState(null);
  const [ignoreReason, setIgnoreReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', filter],
    queryFn: () => api.get('/alerts' + (filter !== 'all' ? '?status=' + filter : '')).then(r => r.data)
  });

  const validateMutation = useMutation({
    mutationFn: ({ id, modified_content }) =>
      api.patch('/alerts/' + id + '/validate', { modified_content }),
    onSuccess: () => {
      toast.success('Alerte validee, section mise a jour');
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dips'] });
      setValidatingId(null);
    },
    onError: (err) => toast.error(err.message)
  });

  const ignoreMutation = useMutation({
    mutationFn: ({ id, reason }) => api.patch('/alerts/' + id + '/ignore', { reason }),
    onSuccess: () => {
      toast.success('Alerte ignoree');
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setIgnoreId(null);
    },
    onError: (err) => toast.error(err.message)
  });

  const alerts = data?.alerts || [];
  const pendingCount = alerts.filter(a => a.status === 'pending').length;

  const filters = [
    { key: 'pending', label: 'En attente', count: pendingCount },
    { key: 'validated', label: 'Validees', count: null },
    { key: 'ignored', label: 'Ignorees', count: null },
    { key: 'all', label: 'Toutes', count: null },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Alertes de mise a jour"
        subtitle="Detections automatiques de changements necessitant une mise a jour du DIP"
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={'flex items-center gap-2 px-4 py-2 rounded font-dm-sans text-sm transition-all duration-300 ' +
              (filter === f.key
                ? 'bg-gold/10 text-gold border border-gold/30'
                : 'text-text-secondary border border-border-subtle hover:border-border-default hover:text-text-primary')}
          >
            {f.label}
            {f.count !== null && f.count > 0 && (
              <span className="font-dm-mono text-xs bg-danger/20 text-danger px-1.5 rounded">{f.count}</span>
            )}
          </button>
        ))}
        </div>
        <button
          onClick={async () => {
            const t = toast.loading('Vérification en cours…');
            try {
              const res = await api.post('/alerts/check-renewal');
              const n = res.data.alerts_created;
              toast.success(n > 0 ? `${n} alerte(s) de renouvellement créée(s)` : 'Aucun renouvellement à signaler', { id: t });
              queryClient.invalidateQueries({ queryKey: ['alerts'] });
            } catch (err) {
              toast.error(err.message, { id: t });
            }
          }}
          className="btn-secondary flex items-center gap-2 text-sm py-2"
        >
          <RefreshCw className="w-4 h-4" /> Vérifier renouvellement
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-success/10 border border-success/20 mb-6">
            <Bell className="w-8 h-8 text-success/60" />
          </div>
          <p className="font-cormorant text-2xl text-text-primary mb-2">
            {filter === 'pending' ? 'Aucune alerte en attente' : 'Aucune alerte'}
          </p>
          {filter === 'pending' && (
            <p className="font-dm-sans text-sm text-text-secondary">Votre DIP est a jour.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map(alert => (
            <div key={alert.id} className="card border-border-default">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-dm-mono text-xs text-gold/60">
                      Section {alert.dip_sections?.section_number}
                    </span>
                    <StatusBadge status={alert.urgency || 'moyenne'} />
                    <StatusBadge status={alert.status} />
                  </div>
                  <h3 className="font-dm-sans text-base text-text-primary">
                    {alert.dip_sections?.section_title || 'Section inconnue'}
                  </h3>
                  <p className="font-dm-mono text-xs text-text-secondary mt-1">
                    Source: {alert.source} {alert.created_at && '\u2022 ' + formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
              </div>

              {(alert.old_value || alert.new_value) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {alert.old_value && (
                    <div className="bg-danger/5 border border-danger/20 rounded p-3">
                      <p className="font-dm-mono text-xs text-danger mb-2">Ancienne valeur</p>
                      <p className="font-dm-sans text-sm text-text-primary">{alert.old_value}</p>
                    </div>
                  )}
                  {alert.new_value && (
                    <div className="bg-success/5 border border-success/20 rounded p-3">
                      <p className="font-dm-mono text-xs text-success mb-2">Nouvelle valeur</p>
                      <p className="font-dm-sans text-sm text-text-primary">{alert.new_value}</p>
                    </div>
                  )}
                </div>
              )}

              {alert.suggestion && (
                <div className="bg-gold/5 border border-gold/20 rounded p-3 mb-4">
                  <p className="font-dm-mono text-xs text-gold mb-2">Suggestion IA</p>
                  <p className="font-dm-sans text-sm text-text-primary">{alert.suggestion}</p>
                </div>
              )}

              {validatingId === alert.id && (
                <div className="mb-4 animate-slide-up">
                  <label className="label">Modifier avant validation</label>
                  <textarea
                    className="input-field min-h-28 resize-none font-dm-mono text-sm"
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                  />
                </div>
              )}

              {ignoreId === alert.id && (
                <div className="mb-4 animate-slide-up">
                  <label className="label">Raison de l'ignorance (optionnel)</label>
                  <input type="text" className="input-field" value={ignoreReason}
                    onChange={e => setIgnoreReason(e.target.value)}
                    placeholder="Ex: Information deja prise en compte..."
                  />
                </div>
              )}

              {alert.status === 'pending' && (
                <div className="flex items-center gap-3 pt-4 border-t border-border-subtle flex-wrap">
                  {validatingId === alert.id ? (
                    <>
                      <button
                        onClick={() => validateMutation.mutate({ id: alert.id, modified_content: editContent || null })}
                        disabled={validateMutation.isPending}
                        className="btn-primary flex items-center gap-2 text-sm py-2"
                      >
                        {validateMutation.isPending && <LoadingSpinner size="sm" />}
                        <CheckCircle className="w-4 h-4" /> Confirmer
                      </button>
                      <button onClick={() => setValidatingId(null)} className="btn-ghost text-sm">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : ignoreId === alert.id ? (
                    <>
                      <button
                        onClick={() => ignoreMutation.mutate({ id: alert.id, reason: ignoreReason })}
                        disabled={ignoreMutation.isPending}
                        className="btn-secondary flex items-center gap-2 text-sm py-2"
                      >
                        {ignoreMutation.isPending && <LoadingSpinner size="sm" />}
                        <XCircle className="w-4 h-4" /> Confirmer l'ignorance
                      </button>
                      <button onClick={() => setIgnoreId(null)} className="btn-ghost text-sm">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setValidatingId(alert.id); setEditContent(alert.suggestion || alert.new_value || ''); }}
                        className="btn-primary flex items-center gap-2 text-sm py-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Valider
                      </button>
                      <button
                        onClick={() => { setValidatingId(alert.id); setEditContent(alert.suggestion || alert.new_value || ''); }}
                        className="btn-secondary flex items-center gap-2 text-sm py-2"
                      >
                        <Edit3 className="w-4 h-4" /> Modifier
                      </button>
                      <button
                        onClick={() => { setIgnoreId(alert.id); setIgnoreReason(''); }}
                        className="btn-ghost flex items-center gap-2 text-sm text-danger hover:text-danger"
                      >
                        <XCircle className="w-4 h-4" /> Ignorer
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}