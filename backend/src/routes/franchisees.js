const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { generateUpdateSummary } = require('../config/claude');
const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/', authMiddleware, requireFranchisor, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('franchisees').select('*').eq('franchiseur_id', req.user.id).order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ franchisees: data });
});

router.post('/', authMiddleware, requireFranchisor, async (req, res) => {
  const { name, email, territory, contract_start, contract_end, status } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Nom et email requis' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Adresse email invalide' });
  if (contract_start && contract_end && new Date(contract_end) <= new Date(contract_start))
    return res.status(400).json({ error: 'La date de fin doit être postérieure à la date de début' });
  const { data: existing } = await supabaseAdmin
    .from('franchisees').select('id').eq('franchiseur_id', req.user.id).eq('email', email).single();
  if (existing) return res.status(409).json({ error: 'Un franchisé avec cet email existe déjà' });
  const { data, error } = await supabaseAdmin.from('franchisees').insert({
    franchiseur_id: req.user.id, name: name.trim(),
    email: email.trim().toLowerCase(), territory: territory?.trim() || null,
    contract_start: contract_start || null, contract_end: contract_end || null,
    status: status || 'actif'
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ franchisee: data });
});

router.put('/:id', authMiddleware, requireFranchisor, async (req, res) => {
  const { name, email, territory, contract_start, contract_end, status } = req.body;
  if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Adresse email invalide' });
  if (contract_start && contract_end && new Date(contract_end) <= new Date(contract_start))
    return res.status(400).json({ error: 'La date de fin doit être postérieure à la date de début' });
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (email !== undefined) updates.email = email.trim().toLowerCase();
  if (territory !== undefined) updates.territory = territory?.trim() || null;
  if (contract_start !== undefined) updates.contract_start = contract_start || null;
  if (contract_end !== undefined) updates.contract_end = contract_end || null;
  if (status !== undefined) updates.status = status;
  const { data, error } = await supabaseAdmin.from('franchisees')
    .update(updates).eq('id', req.params.id).eq('franchiseur_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Franchisé introuvable' });
  res.json({ franchisee: data });
});

router.delete('/:id', authMiddleware, requireFranchisor, async (req, res) => {
  const { error } = await supabaseAdmin.from('franchisees')
    .delete().eq('id', req.params.id).eq('franchiseur_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Franchisé supprimé' });
});

router.post('/notify', authMiddleware, requireFranchisor, async (req, res) => {
  const { dip_id, updated_sections } = req.body;
  if (!dip_id || !updated_sections) return res.status(400).json({ error: 'Paramètres manquants' });
  const { data: franchisees } = await supabaseAdmin
    .from('franchisees').select('*').eq('franchiseur_id', req.user.id).eq('status', 'actif');
  if (!franchisees || franchisees.length === 0) return res.json({ message: 'Aucun franchisé actif', sent: 0 });
  let summary;
  try { summary = await generateUpdateSummary(updated_sections); }
  catch (err) { summary = 'Le DIP a été mis à jour. Veuillez consulter votre espace franchisé pour les détails.'; }
  const notifications = franchisees.map(f => ({
    franchisee_id: f.id, dip_id,
    sections_updated: JSON.stringify(updated_sections),
    message: summary, sent_at: new Date().toISOString(), status: 'sent'
  }));
  await supabaseAdmin.from('notifications').insert(notifications).catch(e => console.error('Notif insert:', e.message));
  if (process.env.BREVO_API_KEY) {
    Promise.all(franchisees.map(f =>
      sendBrevoEmail(f.email, f.name, summary, dip_id).catch(e => console.error('Email error:', e.message))
    )).catch(() => {});
  }
  res.json({ message: `Notifications envoyées à ${franchisees.length} franchisé(s)`, sent: franchisees.length, summary });
});

async function sendBrevoEmail(email, name, summary, dipId) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: process.env.BREVO_SENDER_NAME || 'DIP Pilot', email: process.env.BREVO_SENDER_EMAIL || 'noreply@dip-pilot.fr' },
      to: [{ email, name }],
      subject: 'Mise à jour de votre DIP — Action requise',
      htmlContent: `<div style="font-family:sans-serif;max-width:600px;margin:auto;background:#080808;color:#F4F2EE;padding:32px;border-radius:8px"><h2 style="color:#C8A96E;margin-top:0">Mise à jour du DIP</h2><p style="line-height:1.6">${summary}</p><p style="margin-top:24px"><a href="${process.env.FRONTEND_URL || 'https://app-dpi.vercel.app'}/dip" style="background:#C8A96E;color:#080808;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:600;display:inline-block">Consulter le DIP</a></p></div>`
    })
  });
  if (!response.ok) throw new Error('Brevo error: ' + await response.text());
  return true;
}

module.exports = router;
