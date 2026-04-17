const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Toutes les routes admin requièrent authentification + rôle admin
router.use(authMiddleware, requireAdmin);

// GET /api/admin/users — liste tous les utilisateurs
router.get('/users', async (req, res) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, company_name, is_active, created_at, siret, siren')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ users: users || [] });
  } catch (err) {
    console.error('Admin GET /users error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// POST /api/admin/users — créer un nouveau compte client
router.post('/users', async (req, res) => {
  const { email, password, company_name, role = 'franchiseur' } = req.body;
  if (!email || !password || !company_name) {
    return res.status(400).json({ error: 'Email, mot de passe et nom de société requis' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Format email invalide' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' });
  }
  if (!['franchiseur', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
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
      // Rollback: supprimer l'utilisateur auth si le profil échoue
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Erreur création profil: ' + profileError.message });
    }

    res.status(201).json({
      message: 'Compte client créé avec succès',
      user: { id: authData.user.id, email, company_name, role, is_active: true }
    });
  } catch (err) {
    console.error('Admin POST /users error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id — activer/désactiver un compte
router.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'theo@iralink-agency.com';

  try {
    // Empêcher la désactivation du compte admin principal
    const { data: target } = await supabaseAdmin
      .from('users').select('email, role').eq('id', id).single();

    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (target.email === ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Impossible de modifier le compte administrateur principal' });
    }

    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'Le champ is_active doit être un booléen' });
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_active })
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: is_active ? 'Compte activé' : 'Compte désactivé', id, is_active });
  } catch (err) {
    console.error('Admin PATCH /users/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id — supprimer un compte
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'theo@iralink-agency.com';

  try {
    const { data: target } = await supabaseAdmin
      .from('users').select('email').eq('id', id).single();

    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (target.email === ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Impossible de supprimer le compte administrateur principal' });
    }

    // Suppression auth (cascade sur le profil via FK)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: 'Compte supprimé avec succès', id });
  } catch (err) {
    console.error('Admin DELETE /users/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
