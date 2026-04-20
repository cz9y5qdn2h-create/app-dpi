const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// GET /api/export/:dipId/json - Export JSON complet du DIP
router.get('/:dipId/json', authMiddleware, async (req, res) => {
  const { data: dip, error } = await supabaseAdmin
    .from('dip_documents')
    .select('*, dip_sections(*)')
    .eq('id', req.params.dipId)
    .eq('user_id', req.user.id)
    .single();

  if (error || !dip) return res.status(404).json({ error: 'DIP introuvable' });

  const { data: history } = await supabaseAdmin
    .from('audit_log').select('*').eq('dip_id', req.params.dipId)
    .order('timestamp', { ascending: false });

  res.json({
    dip,
    sections: dip.dip_sections,
    history: history || [],
    exported_at: new Date().toISOString()
  });
});

// GET /api/export/:dipId/report - Rapport de conformité HTML
router.get('/:dipId/report', authMiddleware, async (req, res) => {
  const { data: dip } = await supabaseAdmin
    .from('dip_documents').select('*, dip_sections(*)')
    .eq('id', req.params.dipId).eq('user_id', req.user.id).single();

  if (!dip) return res.status(404).json({ error: 'DIP introuvable' });

  const { data: user } = await supabaseAdmin
    .from('users').select('company_name, email').eq('id', req.user.id).single();

  const sections = dip.dip_sections || [];
  const conforme = sections.filter(s => s.status === 'conforme').length;
  const score = sections.length ? Math.round((conforme / sections.length) * 100) : 0;

  const statusLabel = { conforme: 'Conforme', a_verifier: 'À vérifier', non_conforme: 'Non conforme' };
  const statusColor = { conforme: '#22c55e', a_verifier: '#C8A96E', non_conforme: '#ef4444' };

  const sectionsHtml = sections
    .sort((a, b) => a.section_number - b.section_number)
    .map(s => `
      <div style="margin-bottom:24px;padding:16px;border:1px solid #222;border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h3 style="margin:0;color:#C8A96E">Section ${s.section_number} - ${s.section_title}</h3>
          <span style="color:${statusColor[s.status] || '#5A5A5A'};font-size:12px;font-weight:600">${statusLabel[s.status] || s.status}</span>
        </div>
        <p style="color:#F4F2EE;font-size:14px;white-space:pre-wrap">${s.content || 'Non renseigné'}</p>
        <p style="color:#5A5A5A;font-size:11px">Dernière mise à jour : ${s.last_updated ? new Date(s.last_updated).toLocaleDateString('fr-FR') : 'N/A'}</p>
      </div>`).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport DIP - ${user?.company_name}</title></head><body style="font-family:sans-serif;background:#080808;color:#F4F2EE;padding:40px;max-width:900px;margin:auto">
    <div style="border-bottom:2px solid #C8A96E;padding-bottom:24px;margin-bottom:32px">
      <h1 style="color:#C8A96E;font-size:28px">Rapport de Conformité DIP</h1>
      <p style="color:#F4F2EE">${user?.company_name || 'Franchiseur'}</p>
      <p style="color:#5A5A5A">Généré le ${new Date().toLocaleDateString('fr-FR')} | Score : <strong style="color:#C8A96E">${score}%</strong></p>
    </div>
    <h2 style="color:#F4F2EE">Sections du DIP</h2>
    ${sectionsHtml}
    <footer style="margin-top:48px;padding-top:16px;border-top:1px solid #222;color:#5A5A5A;font-size:11px">
      DIPpro by Iralink — Document généré automatiquement le ${new Date().toLocaleDateString('fr-FR')} — Conforme Loi Doubin Art. L.330-3
    </footer>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="rapport-dip-${req.params.dipId}.html"`);
  res.send(html);
});

module.exports = router;
