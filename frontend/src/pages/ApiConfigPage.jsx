import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  Mail, MessageCircle, Phone, CheckCircle, XCircle,
  ExternalLink, ChevronRight, Eye, EyeOff, Send, RefreshCw,
  Cloud, Database, Link2, Unlink, AlertTriangle, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

function ConnectTile({ icon: Icon, name, description, category, connected, email, expired, onConnect, onDisconnect, configured, loading }) {
  return (
    <div className={`card transition-all ${connected ? 'border-success/20' : 'border-border-default'}`}>
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          connected ? 'bg-success/10 border border-success/20' : 'bg-gold/8 border border-gold/20'
        }`}>
          <Icon className={`w-5 h-5 ${connected ? 'text-success' : 'text-gold'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="font-dm-sans text-sm font-semibold text-text-primary">{name}</p>
            <span className="font-dm-mono text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(200,169,110,0.08)', color: 'rgba(200,169,110,0.7)', border: '0.5px solid rgba(200,169,110,0.15)' }}>
              {category}
            </span>
            {expired && (
              <span className="font-dm-mono text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Token expiré
              </span>
            )}
          </div>
          <p className="font-dm-sans text-xs text-text-secondary">{description}</p>
          {connected && email && (
            <p className="font-dm-mono text-xs text-success/80 mt-1">{email}</p>
          )}
          {!configured && (
            <p className="font-dm-mono text-xs text-text-muted mt-1">
              Nécessite la configuration OAuth côté serveur
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          {loading ? (
            <LoadingSpinner size="sm" />
          ) : connected ? (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 font-dm-sans text-xs px-3 py-1.5 rounded-lg border transition-all hover:bg-danger/5 hover:border-danger/30 hover:text-danger"
              style={{ borderColor: 'rgba(241,124,124,0.20)', color: 'rgba(241,124,124,0.8)' }}
            >
              <Unlink className="w-3 h-3" />
              Déconnecter
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={!configured}
              className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Link2 className="w-3 h-3" />
              Connecter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ ok }) {
  return ok
    ? <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
    : <XCircle className="w-4 h-4 text-text-secondary flex-shrink-0" />;
}

function Section({ title, icon: Icon, children, configured }) {
  const [open, setOpen] = useState(!configured);
  return (
    <div className="card border-border-default">
      <button className="w-full flex items-center justify-between text-left" onClick={() => setOpen(o => !o)}>
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
      else toast.error(`Échec : ${res.data.error}`);
    } catch (err) {
      setResult({ ok: false, error: err.message });
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-bg-elevated rounded border border-border-subtle">
      <p className="font-dm-sans text-sm font-medium text-text-primary mb-3">Tester {label}</p>
      <div className="flex gap-2">
        <input
          className="input-field flex-1 text-sm"
          placeholder={channel === 'email' ? 'votre@email.fr' : '+33612345678'}
          value={target}
          onChange={e => setTarget(e.target.value)}
        />
        <button onClick={test} disabled={loading || !target} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          {loading ? <LoadingSpinner size="sm" /> : <Send className="w-3.5 h-3.5" />}
          Tester
        </button>
      </div>
      {result && (
        <div className={`mt-2 flex items-center gap-2 text-xs font-dm-mono ${result.ok ? 'text-success' : 'text-danger'}`}>
          <StatusDot ok={result.ok} />
          {result.ok ? 'Envoyé avec succès' : (result.error || 'Échec')}
        </div>
      )}
    </div>
  );
}

export default function ApiConfigPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifStatus, setNotifStatus] = useState(null);
  const [loadingNotif, setLoadingNotif] = useState(true);
  const [disconnecting, setDisconnecting] = useState(null);

  const { data: intStatus, isLoading: intLoading, refetch } = useQuery({
    queryKey: ['integrations-status'],
    queryFn: () => api.get('/integrations/status').then(r => r.data),
  });

  useEffect(() => {
    api.get('/notifications/status').then(r => setNotifStatus(r.data)).finally(() => setLoadingNotif(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    if (connected) {
      toast.success(`${connected.replace('_', ' ')} connecté avec succès !`);
      queryClient.invalidateQueries({ queryKey: ['integrations-status'] });
      navigate('/integrations', { replace: true });
    }
    if (error) {
      toast.error(`Erreur OAuth : ${error}`);
      navigate('/integrations', { replace: true });
    }
  }, [location.search]);

  const handleConnect = (provider) => {
    window.location.href = `/api/integrations/${provider}/connect`;
  };

  const handleGoogleConnect = (scope) => {
    window.location.href = `/api/integrations/google/connect?scope=${scope}`;
  };

  const handleDisconnect = async (provider, endpoint, queryParam = '') => {
    setDisconnecting(provider);
    try {
      await api.delete(`/integrations/${endpoint}${queryParam}`);
      toast.success('Déconnecté');
      queryClient.invalidateQueries({ queryKey: ['integrations-status'] });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDisconnecting(null);
    }
  };

  const gc = intStatus?.configured?.google;
  const mc = intStatus?.configured?.microsoft;

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      <PageHeader
        title="Intégrations"
        subtitle="Connectez vos sources de données et canaux de notification"
        action={
          <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        }
      />

      {/* Section : Stockage & Documents */}
      <div>
        <div className="mb-3">
          <p className="mono-label-v2">Sources de documents</p>
          <p className="font-dm-sans text-sm text-text-secondary mt-1">
            Connectez vos espaces de stockage pour importer automatiquement vos DIP et contrats.
          </p>
        </div>

        {intLoading ? (
          <div className="card flex items-center justify-center py-12"><LoadingSpinner size="md" /></div>
        ) : (
          <div className="space-y-3">
            <ConnectTile
              icon={Cloud}
              name="Google Drive"
              description="Importe et surveille vos documents DIP depuis Google Drive."
              category="Stockage"
              connected={intStatus?.google_drive?.connected}
              email={intStatus?.google_drive?.email}
              expired={intStatus?.google_drive?.expired}
              configured={gc}
              loading={disconnecting === 'google_drive'}
              onConnect={() => handleGoogleConnect('drive')}
              onDisconnect={() => handleDisconnect('google_drive', 'google', '?scope=drive')}
            />
            <ConnectTile
              icon={Database}
              name="Microsoft OneDrive"
              description="Accédez à vos documents Word / PDF stockés sur OneDrive ou SharePoint."
              category="Stockage"
              connected={intStatus?.microsoft_onedrive?.connected}
              email={intStatus?.microsoft_onedrive?.email}
              expired={intStatus?.microsoft_onedrive?.expired}
              configured={mc}
              loading={disconnecting === 'microsoft_onedrive'}
              onConnect={() => handleConnect('microsoft')}
              onDisconnect={() => handleDisconnect('microsoft_onedrive', 'microsoft')}
            />
          </div>
        )}

        {!intLoading && !gc && !mc && (
          <div className="mt-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-dm-sans text-sm font-medium text-text-primary">Configuration OAuth requise</p>
                <p className="font-dm-sans text-xs text-text-secondary mt-1">
                  Pour activer Google Drive et OneDrive, définissez <code className="text-gold text-xs">GOOGLE_CLIENT_ID</code>, <code className="text-gold text-xs">GOOGLE_CLIENT_SECRET</code>, <code className="text-gold text-xs">MICROSOFT_CLIENT_ID</code> et <code className="text-gold text-xs">MICROSOFT_CLIENT_SECRET</code> dans vos variables d'environnement Vercel.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section : Email */}
      <div>
        <div className="mb-3">
          <p className="mono-label-v2">Email & Notifications</p>
          <p className="font-dm-sans text-sm text-text-secondary mt-1">
            Configurez les canaux de communication pour vos franchisés.
          </p>
        </div>

        <div className="space-y-3">
          {!intLoading && (
            <ConnectTile
              icon={Mail}
              name="Gmail"
              description="Lisez vos emails liés aux mises à jour DIP directement dans DIPpro."
              category="Email"
              connected={intStatus?.google_gmail?.connected}
              email={intStatus?.google_gmail?.email}
              expired={intStatus?.google_gmail?.expired}
              configured={gc}
              loading={disconnecting === 'google_gmail'}
              onConnect={() => handleGoogleConnect('gmail')}
              onDisconnect={() => handleDisconnect('google_gmail', 'google', '?scope=gmail')}
            />
          )}
        </div>
      </div>

      {/* Notification channels — Brevo & Twilio */}
      <div>
        <div className="mb-3">
          <p className="mono-label-v2">Canaux de notification</p>
          <p className="font-dm-sans text-sm text-text-secondary mt-1">
            Envoyez des alertes par email, WhatsApp ou SMS à vos franchisés.
          </p>
        </div>

        {loadingNotif ? <div className="card flex items-center justify-center py-12"><LoadingSpinner /></div> : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Email (Brevo)', ok: notifStatus?.email?.configured, icon: Mail },
                { label: 'WhatsApp (Twilio)', ok: notifStatus?.whatsapp?.configured, icon: MessageCircle },
                { label: 'SMS (Twilio)', ok: notifStatus?.sms?.configured, icon: Phone }
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

            <Section title="Email — Brevo (Sendinblue)" icon={Mail} configured={notifStatus?.email?.configured}>
              <div className="space-y-4">
                <p className="font-dm-sans text-sm text-text-secondary">
                  Brevo est gratuit jusqu'à 300 emails/jour.
                </p>
                <div className="space-y-4">
                  <Step n="1" title="Créer un compte Brevo">
                    <p>Rendez-vous sur <a href="https://www.brevo.com" target="_blank" rel="noreferrer" className="text-gold hover:underline inline-flex items-center gap-1">brevo.com <ExternalLink className="w-3 h-3" /></a> et créez un compte gratuit.</p>
                  </Step>
                  <Step n="2" title="Obtenir votre clé API">
                    <p>Dans Brevo : <strong className="text-text-primary">Mon compte → SMTP & API → API Keys → Générer une clé</strong></p>
                  </Step>
                  <Step n="3" title="Variables d'environnement Vercel">
                    <CodeBlock>BREVO_API_KEY=votre-clé-api-brevo</CodeBlock>
                    <CodeBlock>BREVO_SENDER_EMAIL=noreply@votredomaine.fr</CodeBlock>
                    <CodeBlock>BREVO_SENDER_NAME=DIPpro</CodeBlock>
                  </Step>
                </div>
                {notifStatus?.email?.sender && (
                  <div className="flex items-center gap-2 text-xs font-dm-mono text-success bg-success/5 border border-success/20 rounded px-3 py-2">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Expéditeur : {notifStatus.email.sender}
                  </div>
                )}
                <TestPanel channel="email" label="Email" />
              </div>
            </Section>

            <Section title="WhatsApp — Twilio" icon={MessageCircle} configured={notifStatus?.whatsapp?.configured}>
              <div className="space-y-4">
                <p className="font-dm-sans text-sm text-text-secondary">
                  Twilio permet d'envoyer des messages WhatsApp via l'API officielle.
                </p>
                <div className="space-y-4">
                  <Step n="1" title="Créer un compte Twilio">
                    <p>Rendez-vous sur <a href="https://www.twilio.com" target="_blank" rel="noreferrer" className="text-gold hover:underline inline-flex items-center gap-1">twilio.com <ExternalLink className="w-3 h-3" /></a>.</p>
                  </Step>
                  <Step n="2" title="Variables d'environnement Vercel">
                    <CodeBlock>TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</CodeBlock>
                    <CodeBlock>TWILIO_AUTH_TOKEN=votre-auth-token</CodeBlock>
                    <CodeBlock>TWILIO_WHATSAPP_FROM=whatsapp:+14155238886</CodeBlock>
                  </Step>
                </div>
                {notifStatus?.whatsapp?.from && (
                  <div className="flex items-center gap-2 text-xs font-dm-mono text-success bg-success/5 border border-success/20 rounded px-3 py-2">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Expéditeur : {notifStatus.whatsapp.from}
                  </div>
                )}
                <TestPanel channel="whatsapp" label="WhatsApp" />
              </div>
            </Section>

            <Section title="SMS — Twilio" icon={Phone} configured={notifStatus?.sms?.configured}>
              <div className="space-y-4">
                <p className="font-dm-sans text-sm text-text-secondary">
                  Envoi de SMS via Twilio, mêmes identifiants que WhatsApp.
                </p>
                <div className="space-y-4">
                  <Step n="1" title="Variable supplémentaire">
                    <CodeBlock>TWILIO_SMS_FROM=+33XXXXXXXXX</CodeBlock>
                  </Step>
                </div>
                {notifStatus?.sms?.from && (
                  <div className="flex items-center gap-2 text-xs font-dm-mono text-success bg-success/5 border border-success/20 rounded px-3 py-2">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Expéditeur SMS : {notifStatus.sms.from}
                  </div>
                )}
                <TestPanel channel="sms" label="SMS" />
              </div>
            </Section>
          </div>
        )}
      </div>

      <div className="card border-border-subtle bg-bg-elevated">
        <p className="font-dm-sans text-xs text-text-secondary leading-relaxed">
          <strong className="text-text-primary">Sécurité :</strong> Les tokens OAuth sont chiffrés en base. Les clés API sont stockées comme variables d'environnement Vercel. Aucune donnée sensible n'est transmise au navigateur.
        </p>
      </div>
    </div>
  );
}
