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

  const updates = {};
  if (company_name !== undefined) updates.company_name = company_name;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;
  if (siret !== undefined) updates.siret = siret;
  if (siren !== undefined) updates.siren = siren;
  if (renewal_alert_date !== undefined) updates.renewal_alert_date = renewal_alert_date || null;
  if (automation_level !== undefined) updates.automation_level = parseInt(automation_level, 10);
  if (notifications_email !== undefined) updates.notifications_email = notifications_email;
  if (notifications_inapp !== undefined) updates.notifications_inapp = notifications_inapp;
  if (notifications_sms !== undefined) updates.notifications_sms = notifications_sms;
  if (notification_frequency !== undefined) updates.notification_frequency = notification_frequency;

  const { data, error } = await supabaseAdmin
    .from('users').update(updates).eq('id', req.user.id).select().single();
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
