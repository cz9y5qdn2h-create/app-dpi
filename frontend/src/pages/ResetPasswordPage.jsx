import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Eye, EyeOff, CheckCircle, AlertCircle, Lock, ArrowLeft } from 'lucide-react';

const BG = `
  radial-gradient(ellipse 55% 50% at 15% 70%, rgba(200,169,110,0.20) 0%, transparent 60%),
  radial-gradient(ellipse 40% 60% at 80% 20%, rgba(180,140,70,0.14) 0%, transparent 55%),
  linear-gradient(160deg, #0a0805 0%, #0f0d08 25%, #080808 55%, #060606 100%)
`;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('Lien invalide. Faites une nouvelle demande.');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Une erreur est survenue.');
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BG }}>
      <div className="w-full max-w-sm">

        <div className="flex items-center gap-3 mb-10">
          <div className="lg-avatar">
            <Shield className="w-4 h-4" style={{ color: '#C8A96E' }} />
          </div>
          <p className="font-cormorant text-xl" style={{ color: '#F4F2EE' }}>DIPpro</p>
        </div>

        <div className="mb-8">
          <h1 className="font-cormorant text-3xl mb-1" style={{ color: '#F4F2EE', fontWeight: 300 }}>
            Nouveau mot de passe
          </h1>
          <p className="font-dm-sans text-sm" style={{ color: 'rgba(244,242,238,0.44)' }}>
            Choisissez un mot de passe sécurisé d'au moins 8 caractères.
          </p>
        </div>

        {success ? (
          <div className="rounded-xl px-5 py-6 text-center space-y-3" style={{
            background: 'rgba(52,211,153,0.06)',
            border: '0.5px solid rgba(52,211,153,0.25)',
          }}>
            <CheckCircle className="w-8 h-8 mx-auto" style={{ color: 'rgb(52,211,153)' }} />
            <p className="font-dm-sans text-sm" style={{ color: 'rgba(244,242,238,0.80)' }}>
              Mot de passe mis à jour — redirection…
            </p>
          </div>
        ) : !token ? (
          <div className="space-y-5">
            <div className="rounded-xl px-5 py-5 text-center space-y-2" style={{
              background: 'rgba(248,113,113,0.06)',
              border: '0.5px solid rgba(248,113,113,0.20)',
            }}>
              <AlertCircle className="w-7 h-7 mx-auto" style={{ color: '#F87171' }} />
              <p className="font-dm-sans text-sm" style={{ color: '#F87171' }}>
                Lien invalide. Faites une nouvelle demande.
              </p>
            </div>
            <Link
              to="/forgot-password"
              className="flex items-center justify-center gap-1.5 font-dm-sans text-sm py-3 rounded-xl transition-all"
              style={{
                background: 'rgba(200,169,110,0.10)',
                border: '0.5px solid rgba(200,169,110,0.30)',
                color: '#C8A96E',
              }}
            >
              Faire une nouvelle demande
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-xl px-4 py-3 mb-5 space-y-3" style={{
                background: 'rgba(248,113,113,0.08)',
                border: '0.5px solid rgba(248,113,113,0.25)',
              }}>
                <div className="flex items-center gap-2.5 font-dm-sans text-sm" style={{ color: '#F87171' }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
                {(error.includes('expiré') || error.includes('invalide') || error.includes('utilisé')) && (
                  <Link
                    to="/forgot-password"
                    className="block text-center font-dm-sans text-xs py-2 rounded-lg transition-all"
                    style={{
                      background: 'rgba(200,169,110,0.08)',
                      border: '0.5px solid rgba(200,169,110,0.25)',
                      color: '#C8A96E',
                    }}
                  >
                    Faire une nouvelle demande →
                  </Link>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="lg-label">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="lg-input"
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(244,242,238,0.35)' }}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="lg-label">Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="lg-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-dm-sans text-sm transition-all mt-2"
                style={{
                  background: loading || !password || !confirm ? 'rgba(200,169,110,0.25)' : 'rgba(200,169,110,0.16)',
                  border: `0.5px solid ${loading || !password || !confirm ? 'rgba(200,169,110,0.20)' : 'rgba(200,169,110,0.42)'}`,
                  color: loading || !password || !confirm ? 'rgba(200,169,110,0.50)' : '#C8A96E',
                  cursor: loading || !password || !confirm ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Mise à jour…
                  </span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Définir le nouveau mot de passe
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
