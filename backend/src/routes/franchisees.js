const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { generateUpdateSummary } = require('../config/claude');
const router = express.Router();

const MAX_CSV_ROWS = 500;

// POST /api/franchisees/import-csv — import CSV bulk
router.post('/import-csv', authMiddleware, requireFranchisor, async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows requis (tableau CSV parsé)' });
  }

  if (rows.length > MAX_CSV_ROWS) {
    return res.status(400).json({ error: `Maximum ${MAX_CSV_ROWS} lignes par import` });
  }

  const toInsert = rows
    .filter(r => r.email || r.name)
    .map(r => ({
      franchiseur_id: req.user.id,
      name: (r.name || r.nom || '').trim(),
      email: (r.email || '').trim().toLowerCase(),
      phone: (r.phone || r.telephone || r.tel || '').trim() || null,
      whatsapp_number: (r.whatsapp || r.whatsapp_number || '').trim() || null,
      territory: (r.territory || r.territoire || '').trim() || null,
      status: 'actif'
    }))
    .filter(r => r.name && r.email);

  if (toInsert.length === 0) {
    return res.status(400).json({ error: 'Aucune ligne valide (name + email requis)' });
  }

  const { data, error } = await supabaseAdmin
    .from('franchisees')
    .insert(toInsert)
    .select();

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ imported: data.length, franchisees: data });
});

// GET /api/franchisees
router.get('/', authMiddleware, requireFranchisor, async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const from  = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('franchisees')
    .select('id,franchiseur_id,name,email,phone,whatsapp_number,territory,contract_start,contract_end,status,created_at', { count: 'exact' })
    .eq('franchiseur_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.set('Cache-Control', 'private, max-age=15');
  res.json({ franchisees: data, total: count, page, limit });
});

// POST /api/franchisees
router.post('/', authMiddleware, requireFranchisor, async (req, res) => {
  const { name, email, territory, contract_start, contract_end, whatsapp_number, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Nom et email requis' });

  const { data, error } = await supabaseAdmin.from('franchisees').insert({
    franchiseur_id: req.user.id, name, email, territory, contract_start, contract_end,
    whatsapp_number: whatsapp_number || null, phone: phone || null
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ franchisee: data });
});

// PUT /api/franchisees/:id
router.put('/:id', authMiddleware, requireFranchisor, async (req, res) => {
  const { name, email, territory, contract_start, contract_end, status, whatsapp_number, phone } = req.body;
  const { data, error } = await supabaseAdmin.from('franchisees')
    .update({ name, email, territory, contract_start, contract_end, status,
              whatsapp_number: whatsapp_number || null, phone: phone || null })
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendBrevoEmail(email, name, summary, dipId) {
  try {
    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'https://iralink-agency.dippro.business';
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
        htmlContent: `<div style="font-family:sans-serif;max-width:600px;margin:auto;background:#080808;color:#F4F2EE;padding:32px;border-radius:8px"><h2 style="color:#C8A96E">Mise à jour du DIP</h2><p>${escapeHtml(summary)}</p><p style="margin-top:24px"><a href="${frontendUrl}/dip" style="background:#C8A96E;color:#080808;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:600">Consulter le DIP mis à jour</a></p></div>`
      })
    });
    return response.ok;
  } catch (e) { console.error('Brevo error:', e); return false; }
}

module.exports = router;
