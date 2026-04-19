import { useEffect } from 'react';
import { X } from 'lucide-react';

const CAL_URL = import.meta.env.VITE_CAL_COM_URL || 'https://cal.com/theo-coutard-mhdsix/call-clients';

export default function CalModal({ open, onClose }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-bg-card border border-border-default rounded-xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div>
            <h2 className="font-cormorant text-xl text-text-primary">Réserver un appel Iralink</h2>
            <p className="font-dm-sans text-xs text-text-secondary mt-0.5">
              Choisissez un créneau avec notre équipe
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors p-1 rounded hover:bg-bg-elevated"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cal.com iframe */}
        <div className="w-full" style={{ height: '600px' }}>
          <iframe
            src={CAL_URL}
            width="100%"
            height="100%"
            frameBorder="0"
            title="Réserver un appel Iralink"
            style={{ border: 'none', background: '#080808' }}
          />
        </div>
      </div>
    </div>
  );
}
