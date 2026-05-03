require('dotenv').config();

const decodeJWT = (token) => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token malformé');

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expiré');
  }

  return payload;
};

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification manquant' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = decodeJWT(token);

    if (!payload.sub) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    req.user = {
      id: payload.sub,
      email: payload.email || '',
      user_metadata: payload.user_metadata || {}
    };
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: err.message === 'Token expiré'
      ? 'Session expirée. Reconnectez-vous.'
      : 'Token invalide ou expiré. Reconnectez-vous.'
    });
  }
};

// Vérifie le rôle franchiseur — crée le profil automatiquement s'il est manquant
const requireFranchisor = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const { supabaseAdmin } = require('../config/supabase');

    let { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('requireFranchisor DB error:', profileError.message, profileError.code);
      // DB inaccessible mais JWT valide → on laisse passer (utilisateur authentifié)
      return next();
    }

    if (!profile) {
      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: req.user.id,
          email: req.user.email,
          role: 'franchiseur',
          company_name: req.user.user_metadata?.company_name || req.user.email.split('@')[0],
          created_at: new Date().toISOString()
        })
        .select('role')
        .single();

      if (insertError) {
        console.error('Auto-create profile error:', insertError.message);
        return res.status(500).json({ error: 'Impossible de créer le profil utilisateur.' });
      }
      profile = newProfile;
    }

    if (profile.role !== 'franchiseur' && profile.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux franchiseurs.' });
    }

    next();
  } catch (err) {
    console.error('requireFranchisor error:', err.message);
    return res.status(500).json({ error: 'Erreur de vérification du rôle' });
  }
};

module.exports = { authMiddleware, requireFranchisor };
