import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import LoadingSpinner from '../ui/LoadingSpinner';
import { Building2, FileText, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AvocatDashboard() {
  const { profile } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['avocat', 'dashboard'],
    queryFn: () => api.get('/avocat/dashboard').then(r => r.data),
  });

  const franchiseurs = data?.franchiseurs || [];
  const pending = data?.pending || [];

  if (isLoading) {
    return (
      <div data-theme="sobre" className="-m-4 sm:-m-6 lg:-m-8 min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--bg-primary))' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-theme="sobre" className="-m-4 sm:-m-6 lg:-m-8 min-h-screen flex flex-col items-center justify-center gap-4 text-center" style={{ background: 'rgb(var(--bg-primary))' }}>
        <AlertCircle className="w-10 h-10 text-danger/50" />
        <p className="display-v2" style={{ fontSize: 24 }}>Impossible de charger le tableau de bord</p>
        <button onClick={() => window.location.reload()} className="btn-cta-glow">Recharger</button>
      </div>
    );
  }

  return (
    <div data-theme="sobre" className="-m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen" style={{ background: 'rgb(var(--bg-primary))' }}>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div>
          <p className="mono-label-v2">Espace avocat</p>
          <p className="display-v2" style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>Bonjour, {profile?.company_name || 'Maître'}</p>
          <p className="font-dm-sans text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
            {franchiseurs.length} réseau{franchiseurs.length !== 1 ? 'x' : ''} suivi{franchiseurs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Invitations en attente */}
        {pending.length > 0 && (
          <div className="card-v2">
            <p className="mono-label-v2 mb-3">Invitations en attente · {pending.length}</p>
            <div className="space-y-2">
              {pending.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--v2-surface)' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--v2-gold)' }} />
                    <div className="min-w-0">
                      <p className="font-dm-sans text-sm truncate" style={{ color: 'rgb(var(--text-primary))' }}>
                        {r.franchiseur?.company_name || r.franchiseur_id}
                      </p>
                      <p className="font-dm-mono text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                        Invité {formatDistanceToNow(new Date(r.invited_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </div>
                  <span className="font-dm-mono text-xs flex-shrink-0" style={{ color: 'var(--v2-gold)', opacity: 0.7 }}>En attente</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liste des franchiseurs actifs */}
        {franchiseurs.length === 0 ? (
          <div className="card-v2 text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg mb-6" style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-border)' }}>
              <Building2 className="w-8 h-8" style={{ color: 'var(--v2-gold)' }} />
            </div>
            <p className="display-v2 mb-3" style={{ fontSize: 26 }}>Aucun réseau suivi</p>
            <p className="font-dm-sans text-sm mb-8 max-w-sm mx-auto" style={{ color: 'rgb(var(--text-secondary))' }}>
              Vos clients franchiseurs doivent vous inviter depuis leurs paramètres ou vous pouvez leur envoyer votre profil.
            </p>
            <p className="font-dm-mono text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
              Partagez votre email ({profile?.email}) à vos clients pour qu'ils vous invitent.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {franchiseurs.map(r => (
              <FranchiseurCard key={r.id} relation={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FranchiseurCard({ relation }) {
  const { franchiseur, latestDip } = relation;
  const score = latestDip?.conformity_score ?? null;
  const level = score === null ? null : score >= 80 ? 'high' : score >= 50 ? 'mid' : 'low';

  return (
    <div className="card-v2 group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-border)' }}>
          <Building2 className="w-5 h-5" style={{ color: 'var(--v2-gold)' }} />
        </div>
        {score !== null && (
          <div className="score-badge-v2" data-level={level}>
            <span className="v2-num" style={{ fontSize: 32 }}>{score}</span>
            <span className="v2-pct" style={{ fontSize: 16 }}>%</span>
          </div>
        )}
      </div>

      <h3 className="font-dm-sans text-sm font-semibold mb-1 truncate" style={{ color: 'rgb(var(--text-primary))' }}>
        {franchiseur?.company_name || 'Réseau'}
      </h3>
      <p className="font-dm-mono text-xs mb-4 truncate" style={{ color: 'rgb(var(--text-muted))' }}>{franchiseur?.email}</p>

      {latestDip ? (
        <div className="space-y-2 mb-4">
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--v2-border)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${score}%`,
                background: level === 'high' ? 'rgb(91 216 154)' : level === 'mid' ? 'var(--v2-gold)' : 'rgb(241 124 124)',
              }}
            />
          </div>
          <p className="font-dm-sans text-xs flex items-center gap-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(latestDip.upload_date), { addSuffix: true, locale: fr })}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4 py-2">
          <FileText className="w-3.5 h-3.5" style={{ color: 'rgb(var(--text-muted))' }} />
          <span className="font-dm-sans text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Aucun DIP actif</span>
        </div>
      )}

      <Link
        to={`/dip/avocat/${franchiseur?.id}`}
        className="flex items-center justify-between w-full px-3 py-2 rounded-lg font-dm-sans text-sm transition-all"
        style={{ border: '1px solid var(--v2-border-hot)', color: 'var(--v2-gold)' }}
      >
        <span className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" />
          Voir le DIP
        </span>
        <ChevronRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
      </Link>
    </div>
  );
}
