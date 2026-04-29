require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification manquant' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Token invalide ou expiré. Reconnectez-vous.' });
    }
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Erreur d\'authentification' });
  }
};

// Vérifie le rôle franchiseur — crée le profil automatiquement s'il est manquant
const requireFranchisor = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const { supabaseAdmin } = require('../config/supabase');

    let { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    // Profil manquant : le créer automatiquement comme franchiseur
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
        return res.status(403).json({ error: 'Impossible de créer le profil utilisateur.' });
      }
      profile = newProfile;
    }

    if (profile.role !== 'franchiseur' && profile.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux franchiseurs.' });
    }

    next();
  } catch (err) {
    console.error('requireFranchisor error:', err.message);
    return res.status(403).json({ error: 'Erreur de vérification du rôle' });
  }
};

module.exports = { authMiddleware, requireFranchisor };
