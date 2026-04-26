const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const { data: profile } = await supabaseAdmin
    .from('users').select('*').eq('id', req.user.id).single();
  const { data: sources } = await supabaseAdmin
    .from('data_sources').select('*').eq('user_id', req.user.id);
  res.json({ profile, data_sources: sources || [] });
});

router.put('/profile', authMiddleware, async (req, res) => {
  const {
    company_name, phone, address, siret, siren, renewal_alert_date,
    automation_level, notifications_email, notifications_inapp,
    notifications_sms, notification_frequency
  } = req.body;

  // Champs de base (toujours présents — migration 001/002)
  const baseUpdates = {};
  if (company_name !== undefined) baseUpdates.company_name = company_name;
  if (phone !== undefined) baseUpdates.phone = phone;
  if (address !== undefined) baseUpdates.address = address;
  if (siret !== undefined) baseUpdates.siret = siret;
  if (siren !== undefined) baseUpdates.siren = siren;
  if (renewal_alert_date !== undefined) baseUpdates.renewal_alert_date = renewal_alert_date || null;

  // Champs étendus (migration 003 — peuvent être absents)
  const extendedUpdates = {};
  if (automation_level !== undefined) extendedUpdates.automation_level = parseInt(automation_level, 10);
  if (notifications_email !== undefined) extendedUpdates.notifications_email = notifications_email;
  if (notifications_inapp !== undefined) extendedUpdates.notifications_inapp = notifications_inapp;
  if (notifications_sms !== undefined) extendedUpdates.notifications_sms = notifications_sms;
  if (notification_frequency !== undefined) extendedUpdates.notification_frequency = notification_frequency;

  // Essayer d'abord avec tous les champs
  let data, error;
  ({ data, error } = await supabaseAdmin
    .from('users').update({ ...baseUpdates, ...extendedUpdates }).eq('id', req.user.id).select().single());

  // Si erreur de colonne manquante (migration 003 non exécutée), sauvegarder seulement les champs de base
  if (error && error.message.includes('column')) {
    ({ data, error } = await supabaseAdmin
      .from('users').update(baseUpdates).eq('id', req.user.id).select().single());
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ profile: data });
});

router.post('/sources', authMiddleware, async (req, res) => {
  const { type, config } = req.body;
  const { data, error } = await supabaseAdmin
    .from('data_sources').insert({ user_id: req.user.id, type, config: config || {} })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ source: data });
});

router.delete('/sources/:id', authMiddleware, async (req, res) => {
  await supabaseAdmin.from('data_sources')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);
  res.json({ message: 'Source supprimée' });
});

module.exports = router;
