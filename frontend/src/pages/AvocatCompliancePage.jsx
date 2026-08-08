import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import AvocatClientShell from '../components/avocat/AvocatClientShell';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Search, Sparkles, ScrollText } from 'lucide-react';
import toast from 'react-hot-toast';

const SUGGESTIONS = [
  "Le seuil de quasi-exclusivité de 80 % est-il un critère absolu ?",
  "Quelles sont les conséquences d'une clause de non-concurrence post-contractuelle trop large ?",
  "Le franchiseur doit-il actualiser le DIP entre la remise et la signature ?",
  "Un DIP incomplet entraîne-t-il automatiquement la nullité du contrat ?",
];

export default function AvocatCompliancePage() {
  const { franchiseurId } = useParams();
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);

  const searchMutation = useMutation({
    mutationFn: (q) => api.post('/avocat/compliance-search', { question: q, franchiseur_id: franchiseurId }).then(r => r.data),
    onSuccess: (data, q) => {
      setHistory(h => [{ question: q, answer: data.answer }, ...h]);
      setQuestion('');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || searchMutation.isPending) return;
    searchMutation.mutate(question.trim());
  };

  return (
    <AvocatClientShell franchiseurId={franchiseurId} active="recherche">
      <div className="max-w-3xl space-y-6 animate-fade-in">
        <div>
          <p className="mono-label-v2">Assistant juridique</p>
          <p className="display-v2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>Recherche conformité</p>
          <p className="font-dm-sans text-sm mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>
            Posez une question de droit de la franchise — la réponse s'appuie sur le DIP actif de ce client quand c'est pertinent.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-v2">
          <div className="flex items-start gap-3">
            <Search className="w-4 h-4 flex-shrink-0 mt-3" style={{ color: 'var(--v2-gold)' }} />
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ex : la clause de non-concurrence de la section 8 est-elle opposable après résiliation ?"
              rows={3}
              maxLength={2000}
              className="input-field resize-none flex-1"
              style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-border)' }}
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="font-dm-mono text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{question.length}/2000</span>
            <button
              type="submit"
              disabled={!question.trim() || searchMutation.isPending}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-dm-sans"
              style={{ border: '1px solid var(--v2-border-hot)', color: 'var(--v2-gold)' }}
            >
              {searchMutation.isPending ? <LoadingSpinner size="sm" /> : <Sparkles className="w-4 h-4" />}
              Rechercher
            </button>
          </div>
        </form>

        {history.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => setQuestion(s)}
                className="font-dm-sans text-xs px-3 py-2 rounded-lg text-left transition-colors"
                style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-border)', color: 'rgb(var(--text-secondary))' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {history.map((item, i) => (
            <div key={i} className="card-v2">
              <div className="flex items-start gap-2 mb-3">
                <ScrollText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--v2-gold)' }} />
                <p className="font-dm-sans text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{item.question}</p>
              </div>
              <p className="font-dm-sans text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'rgb(var(--text-secondary))' }}>
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </AvocatClientShell>
  );
}
