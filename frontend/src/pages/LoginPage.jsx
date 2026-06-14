import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('fetch') || msg.includes('Invalid value') || msg.includes('Failed to')) {
        setError(t('auth.login.errors.config'));
      } else if (msg.includes('Invalid login') || msg.includes('Identifiants')) {
        setError(t('auth.login.errors.invalid'));
      } else {
        setError(msg || t('auth.login.errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{
      background: `
        radial-gradient(ellipse 55% 50% at 15% 70%, rgba(200,169,110,0.20) 0%, transparent 60%),
        radial-gradient(ellipse 40% 60% at 80% 20%, rgba(180,140,70,0.14) 0%, transparent 55%),
        radial-gradient(ellipse 60% 40% at 60% 85%, rgba(140,100,40,0.10) 0%, transparent 60%),
        linear-gradient(160deg, #0a0805 0%, #0f0d08 25%, #080808 55%, #060606 100%)
      `
    }}>

      {/* Panneau gauche — branding */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12" style={{
        background: 'rgba(8,8,8,0.60)',
        backdropFilter: 'blur(40px)',
        borderRight: '0.5px solid rgba(200,169,110,0.10)'
      }}>
        <div className="flex items-center gap-3">
          <div className="lg-avatar">
            <Shield className="w-4 h-4" style={{ color: '#C8A96E' }} />
          </div>
          <div>
            <p className="font-cormorant text-xl" style={{ color: '#F4F2EE' }}>DIPpro</p>
            <p className="font-dm-mono text-xs" style={{ color: 'rgba(244,242,238,0.35)' }}>by Iralink</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <p className="font-cormorant text-4xl leading-snug mb-4" style={{ color: '#F4F2EE', fontWeight: 300 }}>
              {t('auth.login.tagline')}
            </p>
            <p className="font-dm-sans text-sm leading-relaxed" style={{ color: 'rgba(244,242,238,0.45)' }}>
              {t('auth.login.taglineDesc')}
            </p>
          </div>

          {t('auth.login.features', { returnObjects: true }).map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#C8A96E' }} />
              <span className="font-dm-sans text-sm" style={{ color: 'rgba(244,242,238,0.60)' }}>{item}</span>
            </div>
          ))}
        </div>

        <p className="font-dm-mono text-xs" style={{ color: 'rgba(244,242,238,0.22)' }}>
          Art. L.330-3 Code de commerce
        </p>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="lg-avatar">
              <Shield className="w-4 h-4" style={{ color: '#C8A96E' }} />
            </div>
            <p className="font-cormorant text-xl" style={{ color: '#F4F2EE' }}>DIPpro</p>
          </div>

          <div className="mb-8">
            <h1 className="font-cormorant text-3xl mb-1" style={{ color: '#F4F2EE', fontWeight: 300 }}>{t('auth.login.title')}</h1>
            <p className="font-dm-sans text-sm" style={{ color: 'rgba(244,242,238,0.44)' }}>
              {t('auth.login.subtitle')}{' '}
              <Link to="/register" className="font-medium" style={{ color: '#C8A96E' }}>
                {t('auth.login.startTrial')}
              </Link>
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-5 font-dm-sans text-sm" style={{
              background: 'rgba(248,113,113,0.08)',
              border: '0.5px solid rgba(248,113,113,0.25)',
              color: '#F87171'
            }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="lg-label">{t('auth.login.email')}</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder={t('auth.login.emailPlaceholder')}
                required
                autoComplete="email"
                className="lg-input"
              />
            </div>

            <div>
              <label className="lg-label">{t('auth.login.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="lg-input"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'rgba(244,242,238,0.35)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !form.email || !form.password}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-dm-sans text-sm transition-all mt-2"
              style={{
                background: loading || !form.email || !form.password
                  ? 'rgba(200,169,110,0.25)'
                  : 'rgba(200,169,110,0.16)',
                border: `0.5px solid ${loading || !form.email || !form.password ? 'rgba(200,169,110,0.20)' : 'rgba(200,169,110,0.42)'}`,
                color: loading || !form.email || !form.password ? 'rgba(200,169,110,0.50)' : '#C8A96E',
                cursor: loading || !form.email || !form.password ? 'not-allowed' : 'pointer',
                fontWeight: 500
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {t('auth.login.loading')}
                </span>
              ) : (
                <>
                  {t('auth.login.submit')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="font-dm-sans text-xs text-center mt-6 leading-relaxed" style={{ color: 'rgba(244,242,238,0.30)' }}>
            {t('auth.login.consent')}{' '}
            <Link to="/cgu" className="underline underline-offset-2 transition-colors" style={{ color: 'rgba(200,169,110,0.60)' }}>
              {t('auth.login.consentCgu')}
            </Link>
            {', '}
            <Link to="/privacy" className="underline underline-offset-2 transition-colors" style={{ color: 'rgba(200,169,110,0.60)' }}>
              {t('auth.login.consentPrivacy')}
            </Link>
            {' '}{t('auth.login.consentLegal') !== 'legal notice' ? 'et les' : 'and the'}{' '}
            <Link to="/mentions-legales" className="underline underline-offset-2 transition-colors" style={{ color: 'rgba(200,169,110,0.60)' }}>
              {t('auth.login.consentLegal')}
            </Link>
            {' '}{t('auth.login.consentOf')}
          </p>
          <p className="font-dm-mono text-xs text-center mt-3" style={{ color: 'rgba(244,242,238,0.15)' }}>
            {t('common.security')}
          </p>
        </div>
      </div>
    </div>
  );
}
