require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'theo@iralink-agency.com';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

/**
 * Vérifie le JWT Supabase et expose req.user
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Token d'authentification manquant" });
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
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ error: "Erreur d'authentification" });
  }
};

/**
 * Vérifie que l'utilisateur est franchiseur ou admin et que son compte est actif.
 * À chaîner APRÈS authMiddleware.
 */
const requireFranchisor = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const { supabaseAdmin } = require('../config/supabase');
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role, is_active')
      .eq('id', req.user.id)
      .single();

    if (!profile) {
      return res.status(403).json({ error: 'Profil utilisateur introuvable' });
    }
    if (!profile.is_active) {
      return res.status(403).json({ error: 'Compte désactivé. Contactez l\'administrateur.' });
    }
    if (profile.role !== 'franchiseur' && profile.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux franchiseurs' });
    }
    next();
  } catch (err) {
    console.error('requireFranchisor error:', err.message);
    return res.status(403).json({ error: 'Erreur de vérification du rôle' });
  }
};

/**
 * Vérifie que l'utilisateur est l'administrateur principal.
 * À chaîner APRÈS authMiddleware.
 */
const requireAdmin = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const { supabaseAdmin } = require('../config/supabase');
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role, email, is_active')
      .eq('id', req.user.id)
      .single();

    if (!profile || !profile.is_active) {
      return res.status(403).json({ error: 'Compte inactif ou introuvable' });
    }
    if (profile.role !== 'admin' && profile.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Accès réservé à l'administrateur" });
    }
    next();
  } catch (err) {
    console.error('requireAdmin error:', err.message);
    return res.status(403).json({ error: 'Erreur de vérification admin' });
  }
};

module.exports = { authMiddleware, requireFranchisor, requireAdmin };
