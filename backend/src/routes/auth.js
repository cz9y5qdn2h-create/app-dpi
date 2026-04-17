const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// POST /api/auth/register — réservé à l'administrateur
router.post('/register', authMiddleware, requireAdmin, async (req, res) => {
  const { email, password, company_name, role = 'franchiseur' } = req.body;
  if (!email || !password || !company_name) {
    return res.status(400).json({ error: 'Email, mot de passe et nom de société requis' });
  }
  // Validation email basique
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Format email invalide' });
  }
  // Politique de mot de passe renforcée
  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authError) return res.status(400).json({ error: authError.message });

    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      role,
      company_name,
      is_active: true,
      created_at: new Date().toISOString()
    });

    if (profileError) {
      console.warn('Profile insert error:', profileError.message);
    }

    res.status(201).json({ message: 'Compte créé avec succès', user_id: authData.user.id });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const { data: profile } = await supabaseAdmin
      .from('users').select('*').eq('id', data.user.id).single();

    // Vérifier que le compte est actif
    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      return res.status(403).json({ error: 'Votre compte a été désactivé. Contactez l\'administrateur.' });
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { ...data.user, ...(profile || {}) }
    });
  } catch (err) {
    console.error('Login catch error:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('users').select('*').eq('id', req.user.id).single();
    res.json({ user: { ...req.user, ...(profile || {}) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  res.json({ message: 'Déconnexion réussie' });
});

module.exports = router;
