import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConformityGauge from '../components/dashboard/ConformityGauge';
import AlertCard from '../components/dashboard/AlertCard';
import {
  Upload, RefreshCw, Bell, FileText,
  TrendingUp, AlertTriangle, CheckCircle, Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const SECTION_LABELS = [
  '', 'Identité du franchiseur', 'Historique', 'État du réseau',
  'Comptes annuels', 'Marque & PI', 'Infos financières',
  'Territoire', 'Contrat', 'Litiges', 'Comptes prévisionnels'
];

export default function DashboardPage() {
  const { profile } = useAuth();

  const { data: dipsData, isLoading: dipsLoading } = useQuery({
    queryKey: ['dips'],
    queryFn: () => api.get('/dip').then(r => r.data)
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts', 'pending'],
    queryFn: () => api.get('/alerts?status=pending').then(r => r.data)
  });

  const dip = dipsData?.dips?.[0];
  const pendingAlerts = alertsData?.alerts || [];
  const sections = dip?.dip_sections || [];

  const stats = {
    total: sections.length,
    conforme: sections.filter(s => s.status === 'conforme').length,
    a_verifier: sections.filter(s => s.status === 'a_verifier').length,
    non_conforme: sections.filter(s => s.status === 'non_conforme').length,
  };

  const handleCheck = async () => {
    if (!dip) return;
    await api.post(`/dip/check/${dip.id}`);
  };

  if (dipsLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title={`Bonjour, ${profile?.company_name || 'Franchiseur'}`}
        subtitle="Vue d'ensemble de la conformité de votre DIP"
        action={
          <div className="flex gap-3">
            {dip && (
              <button onClick={handleCheck} className="btn-secondary flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Vérifier
              </button>
            )}
            <Link to="/dip/upload" className="btn-primary flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {dip ? 'Mettre à jour' : 'Importer le DIP'}
            </Link>
          </div>
        }
      />

      {!dip ? (
        /* État vide */
        <div className="card border-dashed border-border-default text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-gold/10 border border-gold/20 mb-6">
            <FileText className="w-8 h-8 text-gold" />
          </div>
          <h2 className="font-cormorant text-2xl text-text-primary mb-3">
            Aucun DIP importé
          </h2>
          <p className="font-dm-sans text-sm text-text-secondary mb-8 max-w-sm mx-auto">
            Importez votre Document d'Information Précontractuelle pour commencer l'analyse de conformité.
          </p>
          <Link to="/dip/upload" className="btn-primary inline-flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Importer mon DIP
          </Link>
        </div>
      ) : (
        <>
          {/* Ligne 1: Score + Statistiques */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Score de conformité */}
            <div className="lg:col-span-1 card flex flex-col items-center justify-center py-8">
              <ConformityGauge score={dip.conformity_score || 0} />
              <p className="font-dm-sans text-xs text-text-secondary mt-3">Score de conformité</p>
            </div>

            {/* Stats cards */}
            <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                icon={<FileText className="w-5 h-5" />}
                label="Sections totales"
                value={stats.total}
                color="text-text-primary"
              />
              <StatCard
                icon={<CheckCircle className="w-5 h-5" />}
                label="Conformes"
                value={stats.conforme}
                color="text-success"
              />
              <StatCard
                icon={<Clock className="w-5 h-5" />}
                label="\u00c0 v\u00e9rifier"
                value={stats.a_verifier}
                color="text-gold"
              />
              <StatCard
                icon={<AlertTriangle className="w-5 h-5" />}
                label="Non conformes"
                value={stats.non_conforme}
                color="text-danger"
              />
            </div>
          </div>

          {/* Ligne 2: Sections + Alertes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Liste des sections */}
            <div className="lg:col-span-2 card">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-cormorant text-xl text-text-primary">Sections du DIP</h2>
                <Link to="/dip" className="text-gold text-sm font-dm-sans hover:text-gold-light transition-colors">
                  Voir tout
                </Link>
              </div>
              <div className="space-y-2">
                {sections
                  .sort((a, b) => a.section_number - b.section_number)
                  .map(section => (
                    <SectionRow key={section.id} section={section} />
                  ))}
                {sections.length === 0 && (
                  <p className="text-text-secondary font-dm-sans text-sm py-4 text-center">
                    Aucune section disponible
                  </p>
                )}
              </div>
            </div>

            {/* Alertes récentes */}
            <div className="card">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <h2 className="font-cormorant text-xl text-text-primary">Alertes</h2>
                  {pendingAlerts.length > 0 && (
                    <span className="font-dm-mono text-xs bg-danger/10 text-danger border border-danger/20 px-2 py-0.5 rounded">
                      {pendingAlerts.length}
                    </span>
                  )}
                </div>
                <Link to="/alerts" className="text-gold text-sm font-dm-sans hover:text-gold-light transition-colors">
                  Voir tout
                </Link>
              </div>

              {alertsLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : pendingAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-10 h-10 text-success/40 mx-auto mb-3" />
                  <p className="font-dm-sans text-sm text-text-secondary">Aucune alerte en attente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingAlerts.slice(0, 4).map(alert => (
                    <AlertCard key={alert.id} alert={alert} compact />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dernière mise à jour */}
          <div className="flex items-center gap-3 text-text-secondary text-xs font-dm-mono">
            <Clock className="w-3 h-3" />
            <span>
              Dernier import : {dip.upload_date
                ? formatDistanceToNow(new Date(dip.upload_date), { addSuffix: true, locale: fr })
                : 'N/A'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="card">
      <div className={`${color} mb-3`}>{icon}</div>
      <p className={`font-cormorant text-3xl font-light ${color}`}>{value}</p>
      <p className="font-dm-sans text-xs text-text-secondary mt-1">{label}</p>
    </div>
  );
}

function SectionRow({ section }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded bg-bg-elevated hover:bg-bg-elevated/80 transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-dm-mono text-xs text-gold/60 w-6 flex-shrink-0">{section.section_number}</span>
        <span className="font-dm-sans text-sm text-text-primary truncate">{section.section_title}</span>
      </div>
      <StatusBadge status={section.status} />
    </div>
  );
}
