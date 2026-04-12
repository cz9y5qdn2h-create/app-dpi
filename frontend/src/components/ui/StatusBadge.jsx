const configs = {
  conforme: { label: 'Conforme', className: 'badge-conforme' },
  a_verifier: { label: 'À vérifier', className: 'badge-a_verifier' },
  non_conforme: { label: 'Non conforme', className: 'badge-non_conforme' },
  pending: { label: 'En attente', className: 'badge bg-gold/10 text-gold border border-gold/20' },
  validated: { label: 'Validé', className: 'badge-conforme' },
  ignored: { label: 'Ignoré', className: 'badge bg-text-muted/20 text-text-secondary border border-text-muted/20' },
  actif: { label: 'Actif', className: 'badge-conforme' },
  inactif: { label: 'Inactif', className: 'badge bg-text-muted/20 text-text-secondary border border-text-muted/20' },
  haute: { label: 'Urgente', className: 'badge bg-danger/10 text-danger border border-danger/20' },
  moyenne: { label: 'Moyenne', className: 'badge-a_verifier' },
  faible: { label: 'Faible', className: 'badge bg-text-secondary/10 text-text-secondary border border-text-muted/20' },
};

export default function StatusBadge({ status }) {
  const cfg = configs[status] || { label: status, className: 'badge bg-bg-elevated text-text-secondary' };
  return <span className={cfg.className}>{cfg.label}</span>;
}
