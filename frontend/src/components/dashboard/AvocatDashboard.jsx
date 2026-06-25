import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import LoadingSpinner from '../ui/LoadingSpinner';
import PageHeader from '../ui/PageHeader';
import { Building2, FileText, Clock, AlertCircle, ChevronRight, Plus } from 'lucide-react';
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
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-danger/50" />
        <p className="font-cormorant text-xl text-text-primary">Impossible de charger le tableau de bord</p>
        <button onClick={() => window.location.reload()} className="btn-ghost text-sm">Recharger</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`Bonjour, ${profile?.company_name || 'Maître'}`}
        subtitle={`${franchiseurs.length} réseau${franchiseurs.length !== 1 ? 'x' : ''} suivi${franchiseurs.length !== 1 ? 's' : ''}`}
      />

      {/* Invitations en attente */}
      {pending.length > 0 && (
        <div className="card border-gold/20">
          <div className="lg-card-header">
            <span className="flex items-center gap-2">
              Invitations en attente
              <span className="lg-badge lg-badge-gold">{pending.length}</span>
            </span>
          </div>
          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.id} className="lg-row justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 className="w-4 h-4 text-gold flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-dm-sans text-sm text-text-primary truncate">
                      {r.franchiseur?.company_name || r.franchiseur_id}
                    </p>
                    <p className="font-dm-mono text-xs text-text-muted">
                      Invité {formatDistanceToNow(new Date(r.invited_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
                <span className="font-dm-mono text-xs text-gold/70 flex-shrink-0">En attente de confirmation</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des franchiseurs actifs */}
      {franchiseurs.length === 0 ? (
        <div className="card border-dashed border-border-default text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-gold/10 border border-gold/20 mb-6">
            <Building2 className="w-8 h-8 text-gold" />
          </div>
          <h2 className="font-cormorant text-2xl text-text-primary mb-3">
            Aucun réseau suivi
          </h2>
          <p className="font-dm-sans text-sm text-text-secondary mb-8 max-w-sm mx-auto">
            Vos clients franchiseurs doivent vous inviter depuis leurs paramètres ou vous pouvez leur envoyer votre profil.
          </p>
          <p className="font-dm-mono text-xs text-text-muted">
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
  );
}

function FranchiseurCard({ relation }) {
  const { franchiseur, latestDip, accepted_at } = relation;
  const score = latestDip?.conformity_score ?? null;

  const scoreColor = score === null ? 'text-text-muted' :
    score >= 80 ? 'text-success' :
    score >= 50 ? 'text-gold' : 'text-danger';

  return (
    <div className="card group hover:border-gold/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-gold/8 border border-gold/15 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-gold/70" />
        </div>
        {score !== null && (
          <div className="text-right">
            <p className={`font-cormorant text-3xl font-semibold ${scoreColor}`}>{score}%</p>
            <p className="font-dm-sans text-xs text-text-muted">conformité</p>
          </div>
        )}
      </div>

      <h3 className="font-dm-sans text-sm font-semibold text-text-primary mb-1 truncate">
        {franchiseur?.company_name || 'Réseau'}
      </h3>
      <p className="font-dm-mono text-xs text-text-muted mb-4 truncate">{franchiseur?.email}</p>

      {latestDip ? (
        <div className="space-y-2 mb-4">
          <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${score}%`,
                background: score >= 80 ? 'rgb(var(--success))' : score >= 50 ? 'rgb(var(--gold))' : 'rgb(var(--danger))'
              }}
            />
          </div>
          <p className="font-dm-sans text-xs text-text-secondary flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(latestDip.upload_date), { addSuffix: true, locale: fr })}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4 py-2">
          <FileText className="w-3.5 h-3.5 text-text-muted" />
          <span className="font-dm-sans text-xs text-text-muted">Aucun DIP actif</span>
        </div>
      )}

      <Link
        to={`/dip/avocat/${franchiseur?.id}`}
        className="flex items-center justify-between w-full px-3 py-2 rounded-lg font-dm-sans text-sm text-gold transition-all group-hover:bg-gold/8"
        style={{ border: '1px solid rgba(200,169,110,0.20)' }}
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
