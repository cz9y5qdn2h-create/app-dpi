import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Download, FileText, BarChart2, FileType } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ExportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dips'],
    queryFn: () => api.get('/dip').then(r => r.data)
  });

  const dip = data?.dips?.find(d => d.status === 'actif') ?? data?.dips?.[0];

  const downloadBlob = async (path, filename, contentType) => {
    if (!dip) return toast.error('Aucun DIP disponible');
    const t = toast.loading('Génération du document…');
    try {
      const res = await api.get(path, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Téléchargement terminé', { id: t });
    } catch (err) {
      toast.error('Erreur lors de l\'export', { id: t });
    }
  };

  const handleExportPDF = () => downloadBlob(
    '/export/' + dip.id + '/pdf',
    'rapport-conformite-' + dip.id.substring(0, 8) + '.pdf',
    'application/pdf'
  );

  const handleExportDOCX = () => downloadBlob(
    '/export/' + dip.id + '/docx',
    'dip-' + dip.id.substring(0, 8) + '.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );

  const handleExportJSON = async () => {
    if (!dip) return toast.error('Aucun DIP disponible');
    try {
      const res = await api.get('/export/' + dip.id + '/json');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dip-export.json';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export JSON téléchargé');
    } catch (err) {
      toast.error('Erreur lors de l\'export');
    }
  };

  const exports = [
    {
      title: 'DIP reformulé (Word)',
      description: 'Le DIP complet avec toutes les sections reformulées par l\'IA, prêt à être signé. Format DOCX éditable.',
      icon: FileType,
      action: handleExportDOCX,
      badge: 'DOCX'
    },
    {
      title: 'Rapport de conformité (PDF)',
      description: 'Rapport complet avec score global, statut de chaque section et synthèse Loi Doubin. Imprimable.',
      icon: BarChart2,
      action: handleExportPDF,
      badge: 'PDF'
    },
    {
      title: 'Export JSON complet',
      description: 'Export brut de toutes les données DIP, sections et historique au format JSON.',
      icon: FileText,
      action: handleExportJSON,
      badge: 'JSON'
    },
  ];

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <PageHeader
        title="Export"
        subtitle="Telechargez votre DIP, le rapport de conformite et l'historique des modifications"
      />

      {isLoading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>
      ) : !dip ? (
        <div className="text-center py-24">
          <Download className="w-10 h-10 text-text-muted mx-auto mb-4" />
          <p className="font-cormorant text-2xl text-text-primary mb-2">Aucun DIP disponible</p>
          <p className="font-dm-sans text-sm text-text-secondary">Importez un DIP pour acceder aux exports.</p>
        </div>
      ) : (
        <>
          {/* Info DIP */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-dm-sans text-sm font-medium text-text-primary">{dip.title}</p>
                <p className="font-dm-mono text-xs text-text-secondary mt-0.5">
                  Score: {dip.conformity_score}% | {dip.dip_sections?.length || 0} sections
                </p>
              </div>
              <div className="text-right">
                <p className="font-dm-mono text-xs text-text-secondary">
                  {dip.upload_date || dip.created_at
                    ? new Date(dip.upload_date || dip.created_at).toLocaleDateString('fr-FR')
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Options d'export */}
          <div className="space-y-4">
            {exports.map(exp => (
              <div key={exp.title} className="card hover:border-border-default transition-all duration-300">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                      <exp.icon className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-dm-sans text-sm font-medium text-text-primary">{exp.title}</p>
                        <span className="font-dm-mono text-xs bg-bg-elevated border border-border-subtle text-text-secondary px-1.5 py-0.5 rounded">{exp.badge}</span>
                      </div>
                      <p className="font-dm-sans text-xs text-text-secondary">{exp.description}</p>
                    </div>
                  </div>
                  <button onClick={exp.action} className="btn-secondary flex items-center gap-2 text-sm py-2 flex-shrink-0 ml-4">
                    <Download className="w-4 h-4" /> Telecharger
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}