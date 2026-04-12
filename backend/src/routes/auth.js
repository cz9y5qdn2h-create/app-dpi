const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, company_name, role = 'franchiseur' } = req.body;
  if (!email || !password || !company_name) {
    return res.status(400).json({ error: 'Email, mot de passe et nom de société requis' });
  }
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authError) return res.status(400).json({ error: authError.message });

    await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      role,
      company_name,
      created_at: new Date().toISOString()
    });

    res.status(201).json({ message: 'Compte créé avec succès', user_id: authData.user.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: 'Identifiants invalides' });

  const { data: profile } = await supabaseAdmin
    .from('users').select('*').eq('id', data.user.id).single();

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: { ...data.user, ...profile }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  const { data: profile } = await supabaseAdmin
    .from('users').select('*').eq('id', req.user.id).single();
  res.json({ user: { ...req.user, ...profile } });
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  await supabase.auth.signOut();
  res.json({ message: 'Déconnexion réussie' });
});

module.exports = router;
