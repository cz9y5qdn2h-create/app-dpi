require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');

// Cache rôle en mémoire — évite 1 requête DB par requête protégée
const roleCache = new Map();
const ROLE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedRole(userId) {
  const entry = roleCache.get(userId);
  if (entry && Date.now() < entry.exp) return entry.role;
  roleCache.delete(userId);
  return null;
}

function setCachedRole(userId, role) {
  roleCache.set(userId, { role, exp: Date.now() + ROLE_TTL });
  if (roleCache.size > 2000) {
    const now = Date.now();
    for (const [k, v] of roleCache) if (now > v.exp) roleCache.delete(k);
  }
}

function invalidateRoleCache(userId) {
  roleCache.delete(userId);
}

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification manquant' });
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.length > 4096) {
    return res.status(401).json({ error: 'Token invalide' });
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' });
    }

    req.user = { id: user.id, email: user.email || '', user_metadata: user.user_metadata || {} };
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré. Reconnectez-vous.' });
  }
};

const requireFranchisor = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });

  // 1. Vérifier le cache
  const cached = getCachedRole(req.user.id);
  if (cached) {
    if (cached !== 'franchiseur' && cached !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux franchiseurs.' });
    }
    return next();
  }

  try {
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('requireFranchisor DB error:', profileError.message);
      return res.status(503).json({ error: 'Service temporairement indisponible.' });
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

    setCachedRole(req.user.id, profile.role);

    if (profile.role !== 'franchiseur' && profile.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux franchiseurs.' });
    }

    next();
  } catch (err) {
    console.error('requireFranchisor error:', err.message);
    return res.status(500).json({ error: 'Erreur de vérification du rôle' });
  }
};

module.exports = { authMiddleware, requireFranchisor, invalidateRoleCache };
