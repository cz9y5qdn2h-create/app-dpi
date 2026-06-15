import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../lib/api';

const SHORTCUTS = [
  { label: '🔍 Checkup complet', msg: 'Fais un checkup complet de mon DIP et dis-moi ce que je dois faire en priorité.' },
  { label: '⚠️ Mes alertes', msg: 'Liste mes alertes en attente et explique lesquelles sont prioritaires.' },
  { label: '📊 Mon score', msg: "Quel est mon score de conformité actuel et comment l'améliorer ?" },
  { label: '👥 Mes franchisés', msg: 'Combien ai-je de franchisés et quel est leur statut ?' },
  { label: '📋 Historique', msg: 'Montre-moi les 10 dernières modifications de mon DIP.' },
  { label: '❓ Aide DIPpro', msg: 'Comment fonctionne DIPpro ? Quelles sont les principales fonctionnalités ?' },
];

const ACTION_LABELS = {
  get_dip_status: 'Consultation du DIP',
  get_pending_alerts: 'Récupération des alertes',
  validate_alert: "Validation d'une correction",
  ignore_alert: 'Alerte ignorée',
  get_franchisees: 'Consultation franchisés',
  get_history: "Lecture de l'historique",
  full_checkup: 'Checkup en cours…',
};

function ActionBadge({ action }) {
  const isError = action.result?.error;
  return (
    <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-dm-mono"
      style={{
        background: isError ? 'rgba(220,38,38,0.08)' : 'rgba(76,175,128,0.08)',
        border: `0.5px solid ${isError ? 'rgba(220,38,38,0.20)' : 'rgba(76,175,128,0.20)'}`,
        color: isError ? 'rgb(220,38,38)' : 'rgb(76,175,128)',
      }}>
      {isError ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
      {ACTION_LABELS[action.tool] || action.tool}
    </div>
  );
}

export default function CopilotChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Bonjour ! Je suis DIPpro Copilot. Je peux consulter votre DIP, vérifier vos alertes et effectuer des actions directement dans l'app. Comment puis-je vous aider ?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastActions, setLastActions] = useState([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput('');
    setLastActions([]);

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      const { data } = await api.post('/copilot/chat', { messages: apiMessages });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.actions?.length > 0) setLastActions(data.actions);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Désolé, une erreur est survenue : ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          background: 'linear-gradient(135deg, #C8A96E, #a07840)',
          boxShadow: open
            ? '0 0 0 3px rgba(200,169,110,0.30), 0 8px 24px rgba(200,169,110,0.35)'
            : '0 4px 20px rgba(200,169,110,0.40), 0 8px 32px rgba(0,0,0,0.20)',
        }}
        title="DIPpro Copilot"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <X className="w-6 h-6 text-white" />
              </motion.div>
            : <motion.div key="sp" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Sparkles className="w-6 h-6 text-white" />
              </motion.div>
          }
        </AnimatePresence>
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
            style={{ background: 'rgb(var(--success))', borderColor: 'rgb(var(--bg-primary))' }} />
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="fixed bottom-24 right-6 z-50 flex flex-col"
            style={{
              width: 380,
              maxWidth: 'calc(100vw - 24px)',
              height: 560,
              maxHeight: 'calc(100vh - 120px)',
              background: 'var(--glass-elevated, rgba(255,255,255,0.92))',
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              border: '1px solid rgba(200,169,110,0.28)',
              borderRadius: 20,
              boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 24px 64px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.80)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0"
              style={{ borderBottom: '0.5px solid rgba(200,169,110,0.18)', background: 'rgba(200,169,110,0.05)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #C8A96E, #a07840)' }}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-dm-sans text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                  DIPpro Copilot
                </p>
                <p className="font-dm-mono text-xs" style={{ color: 'rgb(var(--gold))' }}>
                  {loading ? 'Réfléchit…' : '● En ligne'}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="transition-opacity hover:opacity-60 p-1">
                <X className="w-4 h-4" style={{ color: 'rgb(var(--text-secondary))' }} />
              </button>
            </div>

            {/* Shortcuts */}
            <div className="flex gap-2 px-3 py-2 overflow-x-auto flex-shrink-0"
              style={{ borderBottom: '0.5px solid rgba(200,169,110,0.10)', scrollbarWidth: 'none' }}>
              {SHORTCUTS.map(sc => (
                <button
                  key={sc.label}
                  onClick={() => sendMessage(sc.msg)}
                  disabled={loading}
                  className="whitespace-nowrap font-dm-sans text-xs px-3 py-1.5 rounded-full transition-all flex-shrink-0"
                  style={{
                    background: 'rgba(200,169,110,0.08)',
                    border: '0.5px solid rgba(200,169,110,0.22)',
                    color: 'rgb(var(--gold))',
                  }}
                >
                  {sc.label}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] rounded-2xl px-3.5 py-2.5 font-dm-sans text-sm leading-relaxed"
                    style={m.role === 'user'
                      ? { background: 'rgba(200,169,110,0.18)', border: '0.5px solid rgba(200,169,110,0.35)', color: 'rgb(var(--text-primary))', borderBottomRightRadius: 6 }
                      : { background: 'rgba(255,255,255,0.60)', border: '0.5px solid rgba(200,169,110,0.12)', color: 'rgb(var(--text-primary))', borderBottomLeftRadius: 6, backdropFilter: 'blur(8px)' }
                    }
                  >
                    <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                  </div>
                </div>
              ))}

              {/* Actions exécutées */}
              {lastActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-start pl-1">
                  {lastActions.map((a, i) => <ActionBadge key={i} action={a} />)}
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-4 py-3 flex items-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.60)', border: '0.5px solid rgba(200,169,110,0.12)', borderBottomLeftRadius: 6 }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'rgb(var(--gold))' }} />
                    <span className="font-dm-sans text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>DIPpro Copilot réfléchit…</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-2 flex-shrink-0"
              style={{ borderTop: '0.5px solid rgba(200,169,110,0.12)' }}>
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Posez une question ou donnez un ordre…"
                  rows={1}
                  disabled={loading}
                  className="flex-1 resize-none font-dm-sans text-sm rounded-xl px-3 py-2.5 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.70)',
                    border: '0.5px solid rgba(200,169,110,0.22)',
                    color: 'rgb(var(--text-primary))',
                    maxHeight: 120,
                    overflowY: 'auto',
                  }}
                  onInput={e => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: !input.trim() || loading ? 'rgba(200,169,110,0.15)' : 'rgba(200,169,110,0.90)',
                    border: '0.5px solid rgba(200,169,110,0.35)',
                    color: !input.trim() || loading ? 'rgba(200,169,110,0.40)' : 'white',
                    cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="font-dm-mono text-xs text-center mt-1.5" style={{ color: 'rgba(100,116,139,0.60)' }}>
                Entrée pour envoyer · Shift+Entrée pour saut de ligne
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
