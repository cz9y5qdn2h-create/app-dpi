import { Sparkles } from 'lucide-react';

export default function AIDisclaimer({ className = '' }) {
  return (
    <p className={`flex items-center gap-1.5 font-dm-mono text-xs text-text-muted ${className}`}>
      <Sparkles className="w-3 h-3 flex-shrink-0 opacity-60" />
      Analyse IA — complément à l'avis d'un avocat spécialisé franchise
    </p>
  );
}
