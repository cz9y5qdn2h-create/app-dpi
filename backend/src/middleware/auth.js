const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Middleware d'authentification JWT Supabase
 * Vérifie le token Bearer et attache l'utilisateur à req.user
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification manquant' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Erreur d\'authentification' });
  }
};

/**
 * Middleware rôle franchiseur (admin)
 */
const requireFranchisor = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });

  const { supabaseAdmin } = require('../config/supabase');
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (!profile || profile.role !== 'franchiseur') {
    return res.status(403).json({ error: 'Accès réservé aux franchiseurs' });
  }
  next();
};

module.exports = { authMiddleware, requireFranchisor };
