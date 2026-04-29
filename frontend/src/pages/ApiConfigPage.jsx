import { useState, useEffect } from 'react';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  Mail, MessageCircle, Phone, CheckCircle, XCircle,
  ExternalLink, ChevronRight, Eye, EyeOff, Send, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

function StatusDot({ ok }) {
  return ok
    ? <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
    : <XCircle className="w-4 h-4 text-text-secondary flex-shrink-0" />;
}

function Section({ title, icon: Icon, children, configured }) {
  const [open, setOpen] = useState(!configured);
  return (
    <div className="card border-border-default">
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded flex items-center justify-center ${configured ? 'bg-success/10 border border-success/20' : 'bg-gold/10 border border-gold/20'}`}>
            <Icon className={`w-4 h-4 ${configured ? 'text-success' : 'text-gold'}`} />
          </div>
          <div className="text-left">
            <p className="font-dm-sans text-sm font-medium text-text-primary">{title}</p>
            <p className="font-dm-mono text-xs text-text-secondary mt-0.5">
              {configured ? 'Configuré' : 'Non configuré — cliquez pour voir le guide'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot ok={configured} />
          <ChevronRight className={`w-4 h-4 text-text-secondary transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {open && <div className="mt-5 pt-5 border-t border-border-subtle">{children}</div>}
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="w-7 h-7 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="font-dm-mono text-xs text-gold font-bold">{n}</span>
      </div>
      <div className="flex-1">
        <p className="font-dm-sans text-sm font-medium text-text-primary mb-1">{title}</p>
        <div className="font-dm-sans text-sm text-text-secondary space-y-1">{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <code className="block bg-bg-elevated border border-border-subtle rounded px-3 py-2 font-dm-mono text-xs text-gold break-all mt-1">
      {children}
    </code>
  );
}

function TestPanel({ channel, label }) {
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const test = async () => {
    if (!target) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/notifications/test', { channel, target });
      setResult(res.data);
      if (res.data.ok) toast.success(`Test ${label} réussi !`);
      else toast.error(`Échec test ${label}: ${res.data.error}`);
    } catch (err) {
      setResult({ ok: false, error: err.message });
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const placeholder = channel === 'email'
    ? 'votre@email.fr'
    : channel === 'whatsapp'
      ? '+33612345678'
      : '+33612345678';

  return (
    <div className="mt-4 p-4 bg-bg-elevated rounded border border-border-subtle">
      <p className="font-dm-sans text-sm font-medium text-text-primary mb-3">Tester {label}</p>
      <div className="flex gap-2">
        <input
          className="input-field flex-1 text-sm"
          placeholder={placeholder}
          value={target}
          onChange={e => setTarget(e.target.value)}
        />
        <button
          onClick={test}
          disabled={loading || !target}
          className="btn-primary flex items-center gap-2 whitespace-nowrap"
        >
          {loading ? <LoadingSpinner size="sm" /> : <Send className="w-3.5 h-3.5" />}
          Tester
        </button>
      </div>
      {result && (
        <div className={`mt-2 flex items-center gap-2 text-xs font-dm-mono ${result.ok ? 'text-success' : 'text-danger'}`}>
          <StatusDot ok={result.ok} />
          {result.ok ? 'Message envoyé avec succès' : (result.error || 'Échec')}
        </div>
      )}
    </div>
  );
}

export default function ApiConfigPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications/status');
      setStatus(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  if (loading) return (
    <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="Intégrations"
        subtitle="Configurez les canaux de notification pour vos franchisés"
        action={
          <button onClick={fetchStatus} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        }
      />

      {/* Résumé statut */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Email (Brevo)', ok: status?.email?.configured, icon: Mail },
          { label: 'WhatsApp (Twilio)', ok: status?.whatsapp?.configured, icon: MessageCircle },
          { label: 'SMS (Twilio)', ok: status?.sms?.configured, icon: Phone }
        ].map(({ label, ok, icon: Icon }) => (
          <div key={label} className={`card text-center py-4 border ${ok ? 'border-success/20 bg-success/5' : 'border-border-subtle'}`}>
            <Icon className={`w-5 h-5 mx-auto mb-2 ${ok ? 'text-success' : 'text-text-secondary'}`} />
            <p className="font-dm-sans text-xs text-text-secondary">{label}</p>
            <p className={`font-dm-mono text-xs mt-1 ${ok ? 'text-success' : 'text-danger'}`}>
              {ok ? 'Opérationnel' : 'Non configuré'}
            </p>
          </div>
        ))}
      </div>

      {/* Guide Email Brevo */}
      <Section title="Email — Brevo (Sendinblue)" icon={Mail} configured={status?.email?.configured}>
        <div className="space-y-4">
          <p className="font-dm-sans text-sm text-text-secondary">
            Brevo est gratuit jusqu'à 300 emails/jour. Idéal pour notifier vos franchisés par email.
          </p>

          <div className="space-y-4">
            <Step n="1" title="Créer un compte Brevo">
              <p>Rendez-vous sur <a href="https://www.brevo.com" target="_blank" rel="noreferrer" className="text-gold hover:underline inline-flex items-center gap-1">brevo.com <ExternalLink className="w-3 h-3" /></a> et créez un compte gratuit.</p>
            </Step>
            <Step n="2" title="Obtenir votre clé API">
              <p>Dans Brevo : <strong className="text-text-primary">Mon compte → SMTP & API → API Keys → Générer une clé</strong></p>
            </Step>
            <Step n="3" title="Ajouter les variables d'environnement Vercel">
              <p>Dans votre projet Vercel → Settings → Environment Variables, ajoutez :</p>
              <CodeBlock>BREVO_API_KEY=votre-clé-api-brevo</CodeBlock>
              <CodeBlock>BREVO_SENDER_EMAIL=noreply@votredomaine.fr</CodeBlock>
              <CodeBlock>BREVO_SENDER_NAME=DIPpro</CodeBlock>
              <p className="mt-2 text-xs text-text-secondary">
                ⚠️ L'email expéditeur doit être vérifié dans Brevo (Paramètres → Expéditeurs).
              </p>
            </Step>
            <Step n="4" title="Redéployer">
              <p>Allez dans Vercel → Deployments → cliquez "Redeploy" pour appliquer les variables.</p>
            </Step>
          </div>

          {status?.email?.sender && (
            <div className="flex items-center gap-2 text-xs font-dm-mono text-success bg-success/5 border border-success/20 rounded px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5" />
              Expéditeur configuré : {status.email.sender}
            </div>
          )}

          <TestPanel channel="email" label="Email" />
        </div>
      </Section>

      {/* Guide WhatsApp Twilio */}
      <Section title="WhatsApp — Twilio" icon={MessageCircle} configured={status?.whatsapp?.configured}>
        <div className="space-y-4">
          <p className="font-dm-sans text-sm text-text-secondary">
            Twilio permet d'envoyer des messages WhatsApp réels via l'API officielle. Nécessite un compte Twilio et l'approbation du Business Account WhatsApp.
          </p>

          <div className="space-y-4">
            <Step n="1" title="Créer un compte Twilio">
              <p>Rendez-vous sur <a href="https://www.twilio.com" target="_blank" rel="noreferrer" className="text-gold hover:underline inline-flex items-center gap-1">twilio.com <ExternalLink className="w-3 h-3" /></a>. Compte gratuit avec crédit d'essai inclus.</p>
            </Step>
            <Step n="2" title="Activer le Sandbox WhatsApp (test rapide)">
              <p>Dans Twilio Console : <strong className="text-text-primary">Messaging → Try it out → Send a WhatsApp message</strong></p>
              <p>Le sandbox vous donne un numéro de test immédiatement (ex: +14155238886).</p>
              <p className="text-xs text-gold mt-1">Pour la production, demandez l'approbation de votre Business Account WhatsApp dans Twilio.</p>
            </Step>
            <Step n="3" title="Récupérer vos identifiants">
              <p>Dans Twilio Console → Account Info :</p>
              <CodeBlock>Account SID : ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</CodeBlock>
              <CodeBlock>Auth Token : votre-token-secret</CodeBlock>
            </Step>
            <Step n="4" title="Ajouter les variables Vercel">
              <CodeBlock>TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</CodeBlock>
              <CodeBlock>TWILIO_AUTH_TOKEN=votre-auth-token</CodeBlock>
              <CodeBlock>TWILIO_WHATSAPP_FROM=whatsapp:+14155238886</CodeBlock>
              <p className="text-xs text-text-secondary mt-1">
                Remplacez le numéro par votre numéro Twilio WhatsApp approuvé en production.
              </p>
            </Step>
          </div>

          {status?.whatsapp?.from && (
            <div className="flex items-center gap-2 text-xs font-dm-mono text-success bg-success/5 border border-success/20 rounded px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5" />
              Expéditeur : {status.whatsapp.from}
            </div>
          )}

          <TestPanel channel="whatsapp" label="WhatsApp" />
        </div>
      </Section>

      {/* Guide SMS Twilio */}
      <Section title="SMS — Twilio" icon={Phone} configured={status?.sms?.configured}>
        <div className="space-y-4">
          <p className="font-dm-sans text-sm text-text-secondary">
            Envoi de SMS via Twilio. Utilise les mêmes identifiants que WhatsApp, avec un numéro SMS dédié.
          </p>

          <div className="space-y-4">
            <Step n="1" title="Acheter un numéro Twilio SMS">
              <p>Dans Twilio Console : <strong className="text-text-primary">Phone Numbers → Buy a number</strong></p>
              <p>Choisissez un numéro avec les capacités SMS activées (~1$/mois).</p>
            </Step>
            <Step n="2" title="Ajouter la variable Vercel">
              <p>Avec les mêmes TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN déjà configurés :</p>
              <CodeBlock>TWILIO_SMS_FROM=+33XXXXXXXXX</CodeBlock>
              <p className="text-xs text-text-secondary mt-1">
                Utilisez le numéro Twilio au format international (+33...).
              </p>
            </Step>
          </div>

          {status?.sms?.from && (
            <div className="flex items-center gap-2 text-xs font-dm-mono text-success bg-success/5 border border-success/20 rounded px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5" />
              Expéditeur SMS : {status.sms.from}
            </div>
          )}

          <TestPanel channel="sms" label="SMS" />
        </div>
      </Section>

      {/* Note sécurité */}
      <div className="card border-border-subtle bg-bg-elevated">
        <p className="font-dm-sans text-xs text-text-secondary leading-relaxed">
          <strong className="text-text-primary">Sécurité :</strong> Toutes les clés API sont stockées comme variables d'environnement Vercel (chiffrées) et ne sont jamais exposées au navigateur.
          Les messages sont envoyés uniquement aux franchisés actifs de votre réseau.
        </p>
      </div>
    </div>
  );
}
