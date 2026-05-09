const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

const requireAdmin = async (req, res, next) => {
  const { data } = await supabaseAdmin.from('users').select('role').eq('id', req.user.id).single();
  if (data?.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  next();
};

// POST /api/waitlist — public, sans authentification
router.post('/', async (req, res) => {
  const { email, company_name, phone, message, source, user_id } = req.body;

  if (!email || !company_name) {
    return res.status(400).json({ error: 'Email et nom de société requis' });
  }

  const { data: existing } = await supabaseAdmin
    .from('waitlist').select('id').eq('email', email.toLowerCase().trim()).maybeSingle();

  if (existing) {
    return res.json({ message: 'Vous êtes déjà sur la liste d\'attente', already_exists: true });
  }

  const { error } = await supabaseAdmin.from('waitlist').insert({
    email:        email.toLowerCase().trim(),
    company_name: company_name.trim(),
    phone:        phone?.trim() || null,
    message:      message?.trim() || null,
    source:       ['trial_expired', 'register', 'standalone'].includes(source) ? source : 'standalone',
    user_id:      user_id || null,
    status:       'pending'
  });

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ message: 'Inscription confirmée — nous vous contacterons très bientôt.' });
});

// GET /api/waitlist — admin uniquement
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  const { status } = req.query;
  let query = supabaseAdmin.from('waitlist').select('*').order('created_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const total = data?.length || 0;
  const pending = (data || []).filter(w => w.status === 'pending').length;
  res.json({ waitlist: data || [], total, pending });
});

// PATCH /api/waitlist/:id — admin uniquement
router.patch('/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { status, notes } = req.body;
  const updates = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  const { error } = await supabaseAdmin.from('waitlist').update(updates).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Mis à jour' });
});

// DELETE /api/waitlist/:id — admin uniquement
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin.from('waitlist').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Supprimé' });
});

module.exports = router;
