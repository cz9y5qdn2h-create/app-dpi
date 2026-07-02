const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { isPasswordPwned } = require('../utils/passwordSecurity');
const router = express.Router();

// Middleware admin strict
const requireAdmin = async (req, res, next) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('users').select('role').eq('id', req.user.id).single();

    if (error && error.code !== 'PGRST116') {
      console.error('requireAdmin DB error:', error.message);
      return res.status(500).json({ error: 'Vérification du rôle impossible' });
    }

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    next();
  } catch (err) {
    console.error('requireAdmin exception:', err.message);
    return res.status(500).json({ error: 'Erreur de vérification du rôle' });
  }
};

// GET /api/admin/stats — Vue globale
router.get('/stats', authMiddleware, requireAdmin, async (req, res) => {
  const [
    { count: totalUsers },
    { count: totalDips },
    { count: totalFranchisees },
    { count: pendingAlerts }
  ] = await Promise.all([
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('dip_documents').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('franchisees').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'pending')
  ]);

  const { data: recentActivity } = await supabaseAdmin
    .from('audit_log').select('action, timestamp, user_id').order('timestamp', { ascending: false }).limit(10);

  const { data: dipScores } = await supabaseAdmin
    .from('dip_documents').select('conformity_score').eq('status', 'actif');

  const avgScore = dipScores?.length
    ? Math.round(dipScores.reduce((s, d) => s + (d.conformity_score || 0), 0) / dipScores.length)
    : 0;

  res.json({ totalUsers, totalDips, totalFranchisees, pendingAlerts, avgScore, recentActivity: recentActivity || [] });
});

// GET /api/admin/users — Liste tous les franchiseurs
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const from  = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('users')
    .select('id, email, role, company_name, created_at, siret, automation_level', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ users: data, total: count, page, limit });
});

// GET /api/admin/users/:id — Détail d'un franchiseur
router.get('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { data: user } = await supabaseAdmin
    .from('users').select('*').eq('id', req.params.id).single();
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const { data: dips } = await supabaseAdmin
    .from('dip_documents').select('id, title, status, conformity_score, created_at')
    .eq('user_id', req.params.id).order('created_at', { ascending: false });

  const { data: franchisees } = await supabaseAdmin
    .from('franchisees').select('id, name, email, status')
    .eq('franchiseur_id', req.params.id);

  res.json({ user, dips: dips || [], franchisees: franchisees || [] });
});

const ALLOWED_ROLES = ['franchiseur', 'admin'];

// PUT /api/admin/users/:id — Modifier un utilisateur
router.put('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { company_name, role, email } = req.body;
  const updates = {};
  if (company_name !== undefined) updates.company_name = String(company_name).substring(0, 200);
  if (role !== undefined) {
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }
    updates.role = role;
  }

  const { data, error } = await supabaseAdmin
    .from('users').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Changer l'email si fourni
  if (email) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, { email });
    if (authError) return res.status(500).json({ error: authError.message });
  }

  res.json({ user: data });
});

// POST /api/admin/users/:id/reset-password — Réinitialiser le mot de passe
router.post('/users/:id/reset-password', authMiddleware, requireAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Mot de passe trop court (min 8 caractères)' });
  }

  const pwnedCheck = await isPasswordPwned(password);
  if (pwnedCheck.pwned) {
    return res.status(400).json({
      error: `Ce mot de passe a été trouvé dans ${pwnedCheck.count.toLocaleString('fr-FR')} fuites de données connues. Choisissez un mot de passe différent.`
    });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, { password });
  if (error) return res.status(500).json({ error: error.message });

  await supabaseAdmin.from('audit_log').insert({
    action: 'admin_password_reset',
    user_id: req.params.id,
    new_content: 'Mot de passe réinitialisé par admin',
    timestamp: new Date().toISOString()
  });

  res.json({ message: 'Mot de passe réinitialisé avec succès' });
});

// DELETE /api/admin/users/:id — Supprimer un compte
router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Compte supprimé' });
});

// POST /api/admin/users — Créer un compte franchiseur
router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
  const { email, password, company_name, role = 'franchiseur' } = req.body;
  if (!email || !password || !company_name) {
    return res.status(400).json({ error: 'Email, mot de passe et société requis' });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true
  });
  if (authError) return res.status(400).json({ error: authError.message });

  const { data: profile } = await supabaseAdmin.from('users').insert({
    id: authData.user.id, email, role, company_name, created_at: new Date().toISOString()
  }).select().single();

  res.status(201).json({ user: profile });
});

// GET /api/admin/dips — Tous les DIPs de tous les franchiseurs
router.get('/dips', authMiddleware, requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('dip_documents')
    .select('*, users(company_name, email)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ dips: data });
});

// GET /api/admin/activity — Journal d'activité global
router.get('/activity', authMiddleware, requireAdmin, async (req, res) => {
  const { data } = await supabaseAdmin
    .from('audit_log')
    .select('*, users(email, company_name)')
    .order('timestamp', { ascending: false })
    .limit(50);
  res.json({ activity: data || [] });
});

module.exports = router;
