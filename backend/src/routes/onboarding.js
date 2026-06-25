const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  const { role } = req.body;

  if (role === 'franchiseur') {
    const { nb_franchisees, has_existing_dip, lawyer_email } = req.body;

    const updates = { onboarding_completed: true };
    if (nb_franchisees !== undefined) updates.nb_franchisees = parseInt(nb_franchisees, 10) || null;
    if (has_existing_dip !== undefined) updates.has_existing_dip = Boolean(has_existing_dip);

    const { error } = await supabaseAdmin.from('users').update(updates).eq('id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });

    if (lawyer_email) {
      const { data: avocatUser } = await supabaseAdmin
        .from('users').select('id, role').eq('email', lawyer_email.trim().toLowerCase()).maybeSingle();

      if (avocatUser?.role === 'avocat') {
        await supabaseAdmin.from('avocat_franchiseurs').upsert({
          avocat_id: avocatUser.id,
          franchiseur_id: req.user.id,
          invited_by: req.user.id,
          status: 'pending'
        }, { onConflict: 'avocat_id,franchiseur_id' });
      }
    }

    return res.json({ ok: true });
  }

  if (role === 'avocat') {
    const { nb_networks, client_emails } = req.body;

    const updates = { onboarding_completed: true };
    if (nb_networks !== undefined) updates.avocat_nb_networks = parseInt(nb_networks, 10) || null;

    const { error } = await supabaseAdmin.from('users').update(updates).eq('id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });

    const emails = Array.isArray(client_emails) ? client_emails.slice(0, 50) : [];
    for (const raw of emails) {
      const email = raw?.trim?.().toLowerCase();
      if (!email) continue;

      const { data: fUser } = await supabaseAdmin
        .from('users').select('id, role').eq('email', email).maybeSingle();

      if (fUser?.role === 'franchiseur') {
        await supabaseAdmin.from('avocat_franchiseurs').upsert({
          avocat_id: req.user.id,
          franchiseur_id: fUser.id,
          invited_by: req.user.id,
          status: 'pending'
        }, { onConflict: 'avocat_id,franchiseur_id' });
      }
    }

    return res.json({ ok: true, invited: emails.length });
  }

  return res.status(400).json({ error: 'Rôle invalide' });
});

module.exports = router;
