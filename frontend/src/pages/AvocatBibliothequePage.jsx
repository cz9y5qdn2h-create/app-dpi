import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import AvocatClientShell from '../components/avocat/AvocatClientShell';
import { LEGAL_ENTRIES, SANCTIONS, CATEGORIES, searchLegalEntries } from '../lib/legalLibrary';
import { Search, ExternalLink, ChevronDown, Scale, X } from 'lucide-react';

const CATEGORY_TONE = {
  'Socle légal':        'var(--v2-gold)',
  'Code civil':         'rgb(122 184 255)',
  'Jurisprudence':      'rgb(91 216 154)',
  "Champ d'application": 'rgb(241 124 124)',
};

function Entry({ entry, expanded, onToggle, query }) {
  const tone = CATEGORY_TONE[entry.category] || 'var(--v2-gold)';
  return (
    <div className="card-v2">
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="font-dm-mono text-xs px-2 py-0.5 rounded" style={{ color: tone, border: `1px solid ${tone}`, opacity: 0.85 }}>
                {entry.ref}
              </span>
              <span className="font-dm-mono text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{entry.category}</span>
            </div>
            <p className="font-dm-sans text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{entry.title}</p>
            <p className="font-dm-sans text-xs mt-1 leading-relaxed" style={{ color: 'rgb(var(--text-secondary))' }}>{entry.summary}</p>
          </div>
          <ChevronDown
            className="w-4 h-4 flex-shrink-0 mt-1 transition-transform"
            style={{ color: 'rgb(var(--text-muted))', transform: expanded ? 'rotate(180deg)' : 'none' }}
          />
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid var(--v2-border)' }}>
          {entry.body.map((p, i) => (
            <p key={i} className="font-dm-sans text-sm leading-relaxed" style={{ color: 'rgb(var(--text-secondary))' }}>{p}</p>
          ))}
          {entry.url && (
            <a
              href={entry.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-dm-mono text-xs mt-1"
              style={{ color: 'var(--v2-gold)' }}
            >
              Consulter la source officielle <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function AvocatBibliothequePage() {
  const { franchiseurId } = useParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Toutes');
  const [expandedId, setExpandedId] = useState(null);

  const results = useMemo(() => {
    const found = searchLegalEntries(query);
    return category === 'Toutes' ? found : found.filter(e => e.category === category);
  }, [query, category]);

  return (
    <AvocatClientShell franchiseurId={franchiseurId} active="bibliotheque">
      <div className="max-w-4xl space-y-6 animate-fade-in">
        <div>
          <p className="mono-label-v2">Référentiel</p>
          <p className="display-v2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>Bibliothèque juridique</p>
          <p className="font-dm-sans text-sm mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>
            Textes, jurisprudence et sanctions applicables au DIP de franchise — le même référentiel que celui appliqué
            par l'analyse automatique des documents de vos clients.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgb(var(--text-muted))' }} />
          <input
            className="input-field pl-9 pr-9"
            placeholder="Rechercher un article, un arrêt, une notion (ex : prévisionnel, 20 jours, non-concurrence)…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Effacer la recherche">
              <X className="w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {['Toutes', ...CATEGORIES].map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="font-dm-mono text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: category === c ? 'var(--v2-surface-hi)' : 'transparent',
                border: `1px solid ${category === c ? 'var(--v2-border-hot)' : 'var(--v2-border)'}`,
                color: category === c ? 'var(--v2-gold)' : 'rgb(var(--text-secondary))',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <p className="font-dm-mono text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
          {results.length} entrée{results.length !== 1 ? 's' : ''}
          {query && ` pour « ${query} »`}
        </p>

        <div className="space-y-3">
          {results.map(entry => (
            <Entry
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            />
          ))}
          {results.length === 0 && (
            <div className="card-v2 text-center py-12">
              <Scale className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgb(var(--text-muted))' }} />
              <p className="font-dm-sans text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                Aucune entrée ne correspond à « {query} ».
              </p>
            </div>
          )}
        </div>

        {category === 'Toutes' && !query && (
          <div className="card-v2">
            <p className="mono-label-v2 mb-4">Sanctions — tableau récapitulatif</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--v2-border)' }}>
                    {['Manquement', 'Sanction', 'Fondement'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-dm-mono text-xs whitespace-nowrap" style={{ color: 'rgb(var(--text-muted))' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SANCTIONS.map((s, i) => (
                    <tr key={i} style={{ borderBottom: i < SANCTIONS.length - 1 ? '1px solid var(--v2-border)' : 'none' }}>
                      <td className="px-3 py-2.5 font-dm-sans text-xs" style={{ color: 'rgb(var(--text-primary))' }}>{s.manquement}</td>
                      <td className="px-3 py-2.5 font-dm-sans text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{s.sanction}</td>
                      <td className="px-3 py-2.5 font-dm-mono text-xs whitespace-nowrap" style={{ color: 'var(--v2-gold)', opacity: 0.8 }}>{s.fondement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AvocatClientShell>
  );
}
