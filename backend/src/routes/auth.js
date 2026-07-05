const express = require('express');
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { isPasswordPwned } = require('../utils/passwordSecurity');
const router = express.Router();

const RESET_TTL_MS = 60 * 60 * 1000; // 1 heure

async function sendResetEmail(toEmail, toName, resetUrl) {
  const key = process.env.BREVO_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_SENDER_NAME || 'DIPpro',
          email: process.env.BREVO_SENDER_EMAIL || 'noreply@dippro.fr',
        },
        to: [{ email: toEmail, name: toName || '' }],
        subject: 'Réinitialisation de votre mot de passe DIPpro',
        htmlContent: `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;background:#0a0805;color:#F4F2EE;padding:36px;border-radius:12px;border:1px solid #2a2218">
  <h2 style="color:#C8A96E;margin:0 0 8px;font-size:22px;font-weight:600">Réinitialisation du mot de passe</h2>
  <p style="color:#a09070;font-size:14px;margin:0 0 28px">Ce lien est valable <strong style="color:#F4F2EE">1 heure</strong>.</p>
  <a href="${resetUrl}" style="display:inline-block;background:rgba(200,169,110,0.16);border:1px solid rgba(200,169,110,0.42);color:#C8A96E;padding:13px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">
    Définir un nouveau mot de passe →
  </a>
  <p style="color:#504838;font-size:12px;margin:28px 0 0;line-height:1.6">
    Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.<br>
    Votre mot de passe actuel reste inchangé.
  </p>
</div>`.trim(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email requis' });

  // Toujours 200 pour ne pas révéler si l'email existe
  const { data: profile } = await supabaseAdmin
    .from('users').select('id, company_name').eq('email', email).single();

  if (profile) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();

    await supabaseAdmin.from('password_reset_tokens')
      .delete()
      .eq('email', email)
      .is('used_at', null);

    await supabaseAdmin.from('password_reset_tokens').insert({
      user_id: profile.id,
      email,
      token,
      expires_at: expiresAt,
    });

    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'https://app-dpi.vercel.app';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await sendResetEmail(email, profile.company_name || '', resetUrl);
  }

  res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'token et password requis' });
  if (password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (min 8 caractères)' });

  const pwnedCheck = await isPasswordPwned(password);
  if (pwnedCheck.pwned) {
    return res.status(400).json({
      error: `Ce mot de passe a été trouvé dans ${pwnedCheck.count.toLocaleString('fr-FR')} fuites de données connues. Choisissez-en un autre.`
    });
  }

  const { data: row } = await supabaseAdmin
    .from('password_reset_tokens')
    .select('*')
    .eq('token', token)
    .is('used_at', null)
    .single();

  if (!row) return res.status(400).json({ error: 'Lien invalide ou déjà utilisé.' });
  if (new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Ce lien a expiré. Faites une nouvelle demande.' });
  }

  const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password });
  if (authErr) return res.status(500).json({ error: authErr.message });

  await supabaseAdmin.from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id);

  res.json({ message: 'Mot de passe mis à jour avec succès.' });
});

// POST /api/auth/check-password — vérification de mot de passe compromis (HaveIBeenPwned k-anonymity)
// Utilisé par le frontend avant un changement de mot de passe (flux Supabase Auth direct côté client)
router.post('/check-password', async (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'password requis' });
  }
  const result = await isPasswordPwned(password);
  res.json(result);
});

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

  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }

  if (!terms_accepted_at) {
    return res.status(400).json({ error: 'Acceptation des CGU requise' });
  }

  if (!ai_disclaimer_accepted) {
    return res.status(400).json({ error: 'Confirmation du disclaimer IA requise' });
  }

  const pwnedCheck = await isPasswordPwned(password);
  if (pwnedCheck.pwned) {
    return res.status(400).json({
      error: `Ce mot de passe a été trouvé dans ${pwnedCheck.count.toLocaleString('fr-FR')} fuites de données connues. Choisissez un mot de passe différent.`
    });
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
      .from('users').select('id, company_name, trial_expires_at').eq('id', req.user.id).single();

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
