import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Scale, Network, Mail, ArrowRight, ArrowLeft, CheckCircle, X } from 'lucide-react';
import api from '../lib/api';

const TOTAL = 3;

const variants = {
  enter: (dir) => ({ x: dir > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -56 : 56, opacity: 0 }),
};

export default function OnboardingAvocat({ profile, onComplete }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nb_networks: '',
    client_emails_raw: '',
  });

  const goTo = (next) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const finish = async () => {
    setSaving(true);
    const emails = form.client_emails_raw
      .split('\n')
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    try {
      await api.post('/onboarding', {
        role: 'avocat',
        nb_networks: form.nb_networks ? parseInt(form.nb_networks, 10) : undefined,
        client_emails: emails,
      });
    } catch {
      // non-blocking
    } finally {
      setSaving(false);
      onComplete();
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onComplete(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: 540, borderRadius: 24, border: '1px solid rgba(200,169,110,0.30)', overflow: 'hidden', background: 'var(--modal-bg, rgba(255,255,255,0.96))', boxShadow: '0 32px 80px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <div>
            <p className="font-dm-mono" style={{ fontSize: 11, color: 'rgb(var(--gold))', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Configuration du compte avocat</p>
            <h2 className="font-cormorant" style={{ fontSize: 22, fontWeight: 600, color: 'rgb(var(--text-primary))', marginTop: 2 }}>
              {profile?.company_name || 'Votre cabinet'}
            </h2>
          </div>
          <button onClick={onComplete} style={{ padding: 8, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgb(var(--text-muted))' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, padding: '16px 24px 0' }}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? 'rgb(var(--gold))' : 'rgb(var(--border-subtle))', transition: 'background 0.3s' }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ minHeight: 240, padding: '28px 24px 20px', position: 'relative', overflow: 'hidden' }}>
          <AnimatePresence custom={dir} mode="wait">
            <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: 'easeInOut' }}>
              {step === 0 && <StepCabinet form={form} set={set} />}
              {step === 1 && <StepClients form={form} set={set} />}
              {step === 2 && <StepDone profile={profile} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px 24px' }}>
          <button
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: step === 0 ? 0.3 : 1, fontSize: 13 }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} /> Retour
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, background: i === step ? 'rgb(var(--gold))' : 'rgba(200,169,110,0.25)', transition: 'all 0.25s' }} />
            ))}
          </div>

          {step < TOTAL - 1 ? (
            <button
              onClick={() => goTo(step + 1)}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontSize: 13 }}
            >
              Suivant <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontSize: 13 }}
            >
              {saving ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <CheckCircle style={{ width: 14, height: 14 }} />}
              Accéder au dashboard
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function StepCabinet({ form, set }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Network style={{ width: 18, height: 18, color: 'rgb(var(--gold))' }} />
        </div>
        <div>
          <p className="font-dm-sans" style={{ fontSize: 15, fontWeight: 600, color: 'rgb(var(--text-primary))' }}>Votre activité</p>
          <p className="font-dm-sans" style={{ fontSize: 12, color: 'rgb(var(--text-secondary))' }}>Combien de réseaux franchise suivez-vous ?</p>
        </div>
      </div>
      <div>
        <label className="font-dm-sans" style={{ fontSize: 12, fontWeight: 500, color: 'rgb(var(--text-secondary))', display: 'block', marginBottom: 6 }}>
          Nombre de réseaux suivis actuellement
        </label>
        <input
          type="number"
          min={0}
          max={999}
          value={form.nb_networks}
          onChange={e => set('nb_networks', e.target.value)}
          placeholder="Ex. 5"
          className="input-field"
          style={{ width: '100%' }}
          autoFocus
        />
        <p className="font-dm-sans" style={{ fontSize: 11, color: 'rgb(var(--text-muted))', marginTop: 6 }}>
          Votre vue avocat centralisera les DIP de tous vos réseaux clients.
        </p>
      </div>
    </div>
  );
}

function StepClients({ form, set }) {
  const count = form.client_emails_raw.split('\n').filter(e => e.trim().includes('@')).length;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mail style={{ width: 18, height: 18, color: 'rgb(var(--gold))' }} />
        </div>
        <div>
          <p className="font-dm-sans" style={{ fontSize: 15, fontWeight: 600, color: 'rgb(var(--text-primary))' }}>Vos clients franchiseurs</p>
          <p className="font-dm-sans" style={{ fontSize: 12, color: 'rgb(var(--text-secondary))' }}>Invitez-les à rejoindre DIPpro (optionnel)</p>
        </div>
      </div>
      <div>
        <label className="font-dm-sans" style={{ fontSize: 12, fontWeight: 500, color: 'rgb(var(--text-secondary))', display: 'block', marginBottom: 6 }}>
          Emails des franchiseurs clients — un par ligne
        </label>
        <textarea
          value={form.client_emails_raw}
          onChange={e => set('client_emails_raw', e.target.value)}
          placeholder={'client1@reseau.fr\nclient2@franchise.com\nclient3@groupe.fr'}
          className="input-field"
          style={{ width: '100%', minHeight: 120, resize: 'vertical', fontFamily: 'DM Mono, monospace', fontSize: 12 }}
          autoFocus
        />
        <p className="font-dm-sans" style={{ fontSize: 11, color: 'rgb(var(--text-muted))', marginTop: 6 }}>
          {count > 0 ? `${count} adresse${count > 1 ? 's' : ''} détectée${count > 1 ? 's' : ''}` : 'Vous pourrez aussi les inviter depuis votre dashboard.'}
        </p>
      </div>
    </div>
  );
}

function StepDone({ profile }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 8 }}>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(200,169,110,0.12)', border: '2px solid rgba(200,169,110,0.40)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Scale style={{ width: 32, height: 32, color: 'rgb(var(--gold))' }} />
      </motion.div>
      <div style={{ textAlign: 'center' }}>
        <p className="font-cormorant" style={{ fontSize: 22, fontWeight: 600, color: 'rgb(var(--text-primary))' }}>
          Bienvenue, {profile?.company_name || 'maître'} !
        </p>
        <p className="font-dm-sans" style={{ fontSize: 13, color: 'rgb(var(--text-secondary))', marginTop: 8, maxWidth: 380 }}>
          Votre espace avocat est prêt. Vous pouvez maintenant suivre et annoter les DIP de vos clients franchiseurs.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['Suivi multi-réseaux', 'Annotations', 'Historique'].map((label) => (
          <div key={label} style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(200,169,110,0.10)', border: '1px solid rgba(200,169,110,0.22)' }}>
            <span className="font-dm-mono" style={{ fontSize: 11, color: 'rgb(var(--gold))' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
