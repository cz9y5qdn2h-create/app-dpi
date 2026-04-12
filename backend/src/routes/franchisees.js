const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { generateUpdateSummary } = require('../config/claude');
const router = express.Router();

// GET /api/franchisees
router.get('/', authMiddleware, requireFranchisor, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('franchisees')
    .select('*')
    .eq('franchiseur_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ franchisees: data });
});

// POST /api/franchisees
router.post('/', authMiddleware, requireFranchisor, async (req, res) => {
  const { name, email, territory, contract_start, contract_end } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Nom et email requis' });

  const { data, error } = await supabaseAdmin.from('franchisees').insert({
    franchiseur_id: req.user.id, name, email, territory, contract_start, contract_end
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ franchisee: data });
});

// PUT /api/franchisees/:id
router.put('/:id', authMiddleware, requireFranchisor, async (req, res) => {
  const { name, email, territory, contract_start, contract_end, status } = req.body;
  const { data, error } = await supabaseAdmin.from('franchisees')
    .update({ name, email, territory, contract_start, contract_end, status })
    .eq('id', req.params.id).eq('franchiseur_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ franchisee: data });
});

// DELETE /api/franchisees/:id
router.delete('/:id', authMiddleware, requireFranchisor, async (req, res) => {
  await supabaseAdmin.from('franchisees')
    .delete().eq('id', req.params.id).eq('franchiseur_id', req.user.id);
  res.json({ message: 'Franchisé supprimé' });
});

// POST /api/franchisees/notify - Notifier les franchisés d'une mise à jour DIP
router.post('/notify', authMiddleware, requireFranchisor, async (req, res) => {
  const { dip_id, updated_sections } = req.body;
  if (!dip_id || !updated_sections) return res.status(400).json({ error: 'Paramètres manquants' });

  const { data: franchisees } = await supabaseAdmin
    .from('franchisees').select('*').eq('franchiseur_id', req.user.id).eq('status', 'actif');

  if (!franchisees || franchisees.length === 0) {
    return res.json({ message: 'Aucun franchisé actif', sent: 0 });
  }

  const summary = await generateUpdateSummary(updated_sections);

  // Enregistrer les notifications
  const notifications = franchisees.map(f => ({
    franchisee_id: f.id,
    dip_id,
    sections_updated: JSON.stringify(updated_sections),
    message: summary,
    sent_at: new Date().toISOString(),
    status: 'sent'
  }));

  await supabaseAdmin.from('notifications').insert(notifications);

  // Envoyer les emails via Brevo (si configuré)
  if (process.env.BREVO_API_KEY) {
    for (const franchisee of franchisees) {
      await sendBrevoEmail(franchisee.email, franchisee.name, summary, dip_id);
    }
  }

  res.json({ message: `Notifications envoyées à ${franchisees.length} franchisé(s)`, summary });
});

async function sendBrevoEmail(email, name, summary, dipId) {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: process.env.BREVO_SENDER_NAME || 'DIP Pilot', email: process.env.BREVO_SENDER_EMAIL || 'noreply@dip-pilot.fr' },
        to: [{ email, name }],
        subject: 'Mise à jour de votre DIP - Action requise',
        htmlContent: `<div style="font-family:sans-serif;max-width:600px;margin:auto;background:#080808;color:#F4F2EE;padding:32px;border-radius:8px"><h2 style="color:#C8A96E">Mise à jour du DIP</h2><p>${summary}</p><p style="margin-top:24px"><a href="${process.env.FRONTEND_URL}/dip" style="background:#C8A96E;color:#080808;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:600">Consulter le DIP mis à jour</a></p></div>`
      })
    });
    return response.ok;
  } catch (e) { console.error('Brevo error:', e); return false; }
}

module.exports = router;
