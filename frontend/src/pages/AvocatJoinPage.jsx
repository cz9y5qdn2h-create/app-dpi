import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Briefcase, CheckCircle, AlertCircle, LogIn, UserPlus } from 'lucide-react';
import { PENDING_AVOCAT_TOKEN_KEY as PENDING_TOKEN_KEY } from '../lib/constants';

export default function AvocatJoinPage() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState('checking'); // checking | joining | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [franchiseurName, setFranchiseurName] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      try { localStorage.setItem(PENDING_TOKEN_KEY, token); } catch {}
      setState('checking');
      return;
    }

    setState('joining');
    api.post(`/avocat/join/${token}`)
      .then((res) => {
        try { localStorage.removeItem(PENDING_TOKEN_KEY); } catch {}
        setFranchiseurName(res.data.franchiseur_name || '');
        setState('success');
        setTimeout(() => navigate('/dashboard'), 2200);
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Erreur inconnue');
        setState('error');
      });
  }, [user, authLoading, token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{
      background: `linear-gradient(160deg, #0a0805 0%, #0f0d08 25%, #080808 55%, #060606 100%)`
    }}>
      <div className="w-full max-w-sm rounded-2xl p-8 text-center space-y-5" style={{
        background: 'rgba(20,18,15,0.85)', border: '0.5px solid rgba(200,169,110,0.20)', backdropFilter: 'blur(20px)'
      }}>
        <div className="w-14 h-14 rounded-xl bg-gold/10 border border-gold/25 flex items-center justify-center mx-auto">
          <Briefcase className="w-7 h-7 text-gold" />
        </div>

        {(authLoading || state === 'checking') && !user && (
          <>
            <div>
              <p className="font-cormorant text-2xl text-text-primary mb-2">Espace avocat DIPpro</p>
              <p className="font-dm-sans text-sm text-text-secondary">
                Connectez-vous ou créez un compte avocat pour accéder à cet espace.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link to="/login" className="btn-primary flex items-center justify-center gap-2">
                <LogIn className="w-4 h-4" /> Se connecter
              </Link>
              <Link to="/register?role=avocat" className="btn-secondary flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" /> Créer un compte avocat
              </Link>
            </div>
          </>
        )}

        {(authLoading || state === 'joining') && user && (
          <div className="flex flex-col items-center gap-3 py-4">
            <LoadingSpinner size="lg" />
            <p className="font-dm-sans text-sm text-text-secondary">Connexion à l'espace du franchiseur…</p>
          </div>
        )}

        {state === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-success mx-auto" />
            <p className="font-cormorant text-2xl text-text-primary">Accès accordé</p>
            <p className="font-dm-sans text-sm text-text-secondary">
              Vous avez désormais accès à l'espace de {franchiseurName || 'ce franchiseur'}. Redirection…
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 text-danger mx-auto" />
            <p className="font-cormorant text-2xl text-text-primary">Accès impossible</p>
            <p className="font-dm-sans text-sm text-text-secondary">{errorMsg}</p>
            <Link to="/dashboard" className="btn-ghost text-sm">Retour au tableau de bord</Link>
          </>
        )}
      </div>
    </div>
  );
}
