import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConformityGauge from '../components/dashboard/ConformityGauge';
import AlertCard from '../components/dashboard/AlertCard';
import CalModal from '../components/CalModal';
import {
  Upload, RefreshCw, Bell, FileText,
  AlertTriangle, CheckCircle, Clock, History,
  Phone, Eye, Sparkles, Users, Download, ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [calOpen, setCalOpen] = useState(false);

  const { data: dipsData, isLoading: dipsLoading, isError: dipsError } = useQuery({
    queryKey: ['dips'],
    queryFn: () => api.get('/dip').then(r => r.data)
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts', 'pending'],
    queryFn: () => api.get('/alerts?status=pending').then(r => r.data),
    retry: false
  });

  const dip = dipsData?.dips?.find(d => d.status === 'actif') ?? dipsData?.dips?.[0];
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

  if (dipsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center">
        <AlertTriangle className="w-10 h-10 text-danger/50" />
        <p className="font-cormorant text-xl text-text-primary">Impossible de charger le tableau de bord</p>
        <p className="font-dm-sans text-sm text-text-secondary">Vérifiez votre connexion ou rechargez la page.</p>
        <button onClick={() => window.location.reload()} className="btn-ghost text-sm">Recharger</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title={`Bonjour, ${profile?.company_name || 'Franchiseur'}`}
        subtitle="Vue d'ensemble de la conformité de votre DIP"
        action={
          dip ? (
            <button onClick={handleCheck} className="btn-secondary flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Vérifier
            </button>
          ) : null
        }
      />

      {/* CTA Principal Buttons — liquid glass */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/dip/upload" className="btn-liquid-glass flex-col py-4 px-4 gap-2 h-auto">
          <Upload className="w-5 h-5" />
          <span>{dip ? 'Nouvelle version' : 'Importer le DIP'}</span>
        </Link>

        <Link to="/dip/generate" className="btn-liquid-glass flex-col py-4 px-4 gap-2 h-auto">
          <Sparkles className="w-5 h-5" />
          <span>Générer un DIP</span>
        </Link>

        <Link to="/history" className={`btn-liquid-glass flex-col py-4 px-4 gap-2 h-auto ${!dip ? 'opacity-40 pointer-events-none' : ''}`}>
          <History className="w-5 h-5" />
          <span>Historique complet</span>
        </Link>

        <button
          onClick={() => setCalOpen(true)}
          className="btn-liquid-glass-prominent flex-col py-4 px-4 gap-2 h-auto w-full"
        >
          <Phone className="w-5 h-5" />
          <span>Contacter Iralink</span>
        </button>
      </div>

      {/* Checklist onboarding — visible uniquement si aucun DIP et nouveau compte */}
      {!dip && <OnboardingChecklist />}

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
          <Link to="/dip/upload" className="btn-liquid-glass inline-flex">
            <Upload className="w-4 h-4" />
            Importer mon DIP
          </Link>
        </div>
      ) : (
        <>
          {/* Ligne 1: Score + Statistiques */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 card flex flex-col items-center justify-center py-8">
              <ConformityGauge score={dip.conformity_score || 0} />
              <p className="font-dm-sans text-xs text-text-secondary mt-3">Score de conformité</p>
            </div>

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
                label="À vérifier"
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

          {/* Niveau d'automatisation actif */}
          {profile?.automation_level && (
            <div className="card border-gold/15 bg-gold/3">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                  <span className="font-cormorant text-xl text-gold">{profile.automation_level}</span>
                </div>
                <div>
                  <p className="font-dm-sans text-sm font-medium text-text-primary">
                    Niveau {profile.automation_level} d'automatisation actif
                  </p>
                  <p className="font-dm-sans text-xs text-text-secondary">
                    {profile.automation_level === 1 && 'Chaque changement doit être approuvé manuellement'}
                    {profile.automation_level === 2 && 'Approbation globale en une action'}
                    {profile.automation_level === 3 && 'Changements appliqués automatiquement après 48h'}
                  </p>
                </div>
                <Link to="/settings" className="ml-auto btn-ghost text-xs py-1.5">
                  Modifier
                </Link>
              </div>
            </div>
          )}

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

      <CalModal open={calOpen} onClose={() => setCalOpen(false)} />
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

function OnboardingChecklist() {
  const STEPS = [
    { icon: Upload, label: 'Importez votre DIP existant', sub: 'ou générez-en un depuis zéro', to: '/dip/upload', cta: 'Importer' },
    { icon: Sparkles, label: 'Générez un DIP avec l\'IA', sub: 'Formulaire guidé, conforme Loi Doubin', to: '/dip/generate', cta: 'Générer' },
    { icon: Users, label: 'Ajoutez vos franchisés', sub: 'Pour les notifier des mises à jour', to: '/franchisees', cta: 'Ajouter' },
    { icon: Download, label: 'Exportez votre premier rapport', sub: 'PDF de conformité ou DIP en DOCX', to: '/export', cta: 'Exporter' },
  ];
  return (
    <div className="card border-gold/15">
      <h2 className="font-cormorant text-xl text-text-primary mb-1">Par où commencer ?</h2>
      <p className="font-dm-sans text-xs text-text-secondary mb-5">Suivez ces étapes pour être opérationnel en quelques minutes.</p>
      <div className="space-y-2">
        {STEPS.map(({ icon: Icon, label, sub, to, cta }) => (
          <Link key={to} to={to} className="flex items-center gap-4 p-3 rounded-lg hover:bg-bg-elevated transition-colors group">
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-dm-sans text-sm text-text-primary">{label}</p>
              <p className="font-dm-sans text-xs text-text-secondary">{sub}</p>
            </div>
            <span className="font-dm-sans text-xs text-gold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              {cta} <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
