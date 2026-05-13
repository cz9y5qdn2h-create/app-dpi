const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const {
    email, password, company_name, phone_number,
    marketing_consent = false,
    ai_disclaimer_accepted = false,
    terms_accepted_at,
    terms_version = '2026-05-13',
    role = 'franchiseur'
  } = req.body;

  if (!email || !password || !company_name) {
    return res.status(400).json({ error: 'Email, mot de passe et nom de société requis' });
  }

  if (!terms_accepted_at) {
    return res.status(400).json({ error: 'Acceptation des CGU requise' });
  }

  if (!ai_disclaimer_accepted) {
    return res.status(400).json({ error: 'Confirmation du disclaimer IA requise' });
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authError) return res.status(400).json({ error: authError.message });

    const trialExpiresAt = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();

    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      role,
      company_name,
      phone: phone_number || null,
      trial_expires_at: trialExpiresAt,
      appointment_booked: false,
      created_at: new Date().toISOString(),
      terms_accepted_at,
      terms_version,
      marketing_consent: Boolean(marketing_consent),
      ai_disclaimer_accepted: Boolean(ai_disclaimer_accepted),
    });

    if (profileError) console.warn('Profile insert error:', profileError.message);

    res.status(201).json({ message: 'Compte créé avec succès', user_id: authData.user.id });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/provision-oauth — créer/mettre à jour le profil après OAuth Google/Apple
// Appelé par le frontend après un sign-in OAuth réussi
router.post('/provision-oauth', authMiddleware, async (req, res) => {
  const { company_name, phone_number } = req.body;

  try {
    const { data: existing } = await supabaseAdmin
      .from('users').select('id, trial_expires_at').eq('id', req.user.id).single();

    if (existing) {
      const updates = {};
      if (company_name && !existing.company_name) updates.company_name = company_name;
      if (phone_number) updates.phone = phone_number;
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('users').update(updates).eq('id', req.user.id);
      }
      return res.json({ message: 'Profil mis à jour', existing: true });
    }

    const trialExpiresAt = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    await supabaseAdmin.from('users').insert({
      id: req.user.id,
      email: req.user.email,
      role: 'franchiseur',
      company_name: company_name || req.user.email.split('@')[0],
      phone: phone_number || null,
      trial_expires_at: trialExpiresAt,
      appointment_booked: false,
      created_at: new Date().toISOString()
    });

    res.status(201).json({ message: 'Profil créé', existing: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/mark-appointment — admin marque un rendez-vous pris (débloque le compte)
router.post('/mark-appointment/:userId', authMiddleware, async (req, res) => {
  const { data: admin } = await supabaseAdmin.from('users').select('role').eq('id', req.user.id).single();
  if (admin?.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });

  await supabaseAdmin
    .from('users')
    .update({ appointment_booked: true })
    .eq('id', req.params.userId);

  res.json({ message: 'Accès débloqué' });
});

// POST /api/auth/request-appointment — l'utilisateur confirme qu'il a pris RDV
router.post('/request-appointment', authMiddleware, async (req, res) => {
  await supabaseAdmin
    .from('users')
    .update({ appointment_booked: false })
    .eq('id', req.user.id);

  res.json({ message: 'Demande enregistrée — accès réactivé par Iralink après confirmation du RDV' });
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
