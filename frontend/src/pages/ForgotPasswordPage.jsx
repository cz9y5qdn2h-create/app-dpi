import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, ArrowLeft, Mail, CheckCircle, AlertCircle } from 'lucide-react';

const BG = `
  radial-gradient(ellipse 55% 50% at 15% 70%, rgba(200,169,110,0.20) 0%, transparent 60%),
  radial-gradient(ellipse 40% 60% at 80% 20%, rgba(180,140,70,0.14) 0%, transparent 55%),
  linear-gradient(160deg, #0a0805 0%, #0f0d08 25%, #080808 55%, #060606 100%)
`;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BG }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="lg-avatar">
            <Shield className="w-4 h-4" style={{ color: '#C8A96E' }} />
          </div>
          <p className="font-cormorant text-xl" style={{ color: '#F4F2EE' }}>DIPpro</p>
        </div>

        <div className="mb-8">
          <h1 className="font-cormorant text-3xl mb-1" style={{ color: '#F4F2EE', fontWeight: 300 }}>
            Mot de passe oublié
          </h1>
          <p className="font-dm-sans text-sm" style={{ color: 'rgba(244,242,238,0.44)' }}>
            Entrez votre email — nous vous envoyons un lien de réinitialisation.
          </p>
        </div>

        {success ? (
          <div className="rounded-xl px-5 py-6 text-center space-y-3" style={{
            background: 'rgba(52,211,153,0.06)',
            border: '0.5px solid rgba(52,211,153,0.25)',
          }}>
            <CheckCircle className="w-8 h-8 mx-auto" style={{ color: 'rgb(52,211,153)' }} />
            <p className="font-dm-sans text-sm" style={{ color: 'rgba(244,242,238,0.80)' }}>
              Email envoyé à <strong>{email}</strong>
            </p>
            <p className="font-dm-mono text-xs" style={{ color: 'rgba(244,242,238,0.38)' }}>
              Vérifiez vos spams si vous ne le recevez pas dans 2 minutes.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-5 font-dm-sans text-sm" style={{
                background: 'rgba(248,113,113,0.08)',
                border: '0.5px solid rgba(248,113,113,0.25)',
                color: '#F87171',
              }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="lg-label">Adresse email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  autoComplete="email"
                  className="lg-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-dm-sans text-sm transition-all mt-2"
                style={{
                  background: loading || !email ? 'rgba(200,169,110,0.25)' : 'rgba(200,169,110,0.16)',
                  border: `0.5px solid ${loading || !email ? 'rgba(200,169,110,0.20)' : 'rgba(200,169,110,0.42)'}`,
                  color: loading || !email ? 'rgba(200,169,110,0.50)' : '#C8A96E',
                  cursor: loading || !email ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Envoi…
                  </span>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Envoyer le lien
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-8 text-center">
          <Link
            to="/login"
            className="flex items-center justify-center gap-1.5 font-dm-sans text-sm transition-colors"
            style={{ color: 'rgba(200,169,110,0.55)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
